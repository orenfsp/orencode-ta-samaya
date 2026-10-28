import calendar
import hashlib
import hmac
import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import AppError, Forbidden, InvalidStatus, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.domain.files import Files
from infrastructure.dictionaries.dictionary_judge_category import DictionaryJudgeCategoryModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.enums import (
    QUALIFICATION_KIND_TITLES,
    QualificationKind,
    QualificationStatus,
    RankKind,
    Role,
    RoleStatus,
)
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T
from qualifications.repositories.pg_qualifications import QualificationRepository

K = QualificationKind
S = QualificationStatus
ZONE = "Asia/Yekaterinburg"


class AlreadyPending(AppError):
    status_code = 409
    code = "already_pending"
    message = "Заявка уже на рассмотрении. Дождитесь решения или отзовите её"


class NotHigher(AppError):
    status_code = 409
    code = "not_higher"
    message = "Можно подать только на ступень выше действующей"


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo(ZONE)).date()


def add_months(start: date, months: int) -> date:
    """Добавляет к дате указанное число месяцев, обрезая день до конца получившегося месяца."""
    month = start.month - 1 + months
    year, month = start.year + month // 12, month % 12 + 1
    return date(year, month, min(start.day, calendar.monthrange(year, month)[1]))


def age_on(birth: date, on: date) -> int:
    """Считает полный возраст на дату on."""
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def birthday(birth: date, years: int) -> date:
    """Возвращает дату дня рождения через years лет от даты рождения."""
    year = birth.year + years
    return date(year, birth.month, min(birth.day, calendar.monthrange(year, birth.month)[1]))


def link_for(kind: QualificationKind, own: bool = True) -> str:
    """Подбирает ссылку личного кабинета для уведомления по разряду или категории."""
    if kind == K.JUDGE_CATEGORY:
        return "/cabinet/judge/category"
    return "/cabinet/athlete/rank" if own else "/cabinet/coach/ranks"


def signature(item: QualificationModel, secret: bytes) -> str:
    """Считает HMAC-подпись присвоенной квалификации для QR-проверки."""
    payload = "|".join(str(value) for value in (
        item.token, item.id, item.user_id, item.kind.value, item.item_id, item.valid_from, item.valid_until,
        item.order_number,
    ))
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


@dataclass(frozen=True, slots=True)
class Mine:
    items: Sequence[QualificationModel]
    submitted: Sequence[QualificationModel]


class Qualifications:
    """Подача, рассмотрение и выдача спортивных разрядов и судейских категорий."""

    def __init__(
        self,
        uow: UnitOfWork,
        repository: QualificationRepository,
        users: UserRepository,
        dictionary: DictionaryRepository,
        files: Files,
        audit: Audit,
        notifications: Notifications,
        secret: str,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._repository, self._users, self._dictionary = uow, repository, users, dictionary
        self._files, self._audit, self._notifications = files, audit, notifications
        self._secret = secret.encode()

    async def submit(
        self,
        actor_id: UUID,
        actor_roles: frozenset[Role],
        kind: QualificationKind,
        user_id: UUID | None,
        item_id: int,
        file_id: UUID,
        basis: str | None,
        ip: str | None,
        result_id: int | None = None,
    ) -> QualificationModel:
        """Подаёт заявку на разряд или категорию, проверяя право подавать, возраст и отсутствие дублей."""
        target = user_id or actor_id
        await self._check_submitter(actor_id, actor_roles, kind, target)
        user = await self._users.get(target)
        if user is None or not user.is_active:
            raise NotFound("Спортсмен не найден")
        item = await self._item(kind, item_id)
        if item is None or item.is_archived:
            raise ValidationFailed(fields={"item_id": ["Выберите значение из справочника"]})
        if isinstance(item, DictionaryRankTypeModel) and item.min_age and age_on(user.birth_date, today()) < item.min_age:
            raise ValidationFailed(fields={"item_id": [f"Присваивается с {item.min_age} лет"]})
        if (
            isinstance(item, DictionaryRankTypeModel)
            and item.rank_kind == RankKind.YOUTH
            and item.valid_until_age
            and age_on(user.birth_date, today()) >= item.valid_until_age
        ):
            raise ValidationFailed(fields={"item_id": [f"Юношеский разряд действует до {item.valid_until_age} лет"]})
        if await self._repository.of_user(target, kind, S.PENDING):
            raise AlreadyPending()
        current = await self._repository.of_user(target, kind, S.APPROVED)
        if current and (current.valid_until is None or current.valid_until >= today()) and item_id >= current.item_id:
            raise NotHigher()
        if result_id is not None:
            if kind != K.RANK or not await self._repository.own_result(result_id, target):
                raise ValidationFailed(fields={"contest_result_id": ["Выберите своё место из истории выступлений"]})
        files, error = await self._files.usable([file_id], actor_id, Role.FEDERATION in actor_roles, Files.DOCUMENT_TYPES)
        if error:
            message = "Загрузите документ в PDF или DOCX" if error == "type" else error
            raise ValidationFailed(fields={"document_file_id": [message]})
        created = await self._repository.add(
            QualificationModel(
                kind=kind,
                user_id=target,
                submitted_by=actor_id,
                status=S.PENDING,
                document_file_id=files[0].id,
                judge_category_id=item_id if kind == K.JUDGE_CATEGORY else None,
                rank_type_id=item_id if kind == K.RANK else None,
                basis=(basis or "").strip() or None,
                contest_result_id=result_id,
            )
        )
        await self._audit.write(
            AuditAction.QUALIFICATION_SUBMIT, actor_id, "qualification", created.id,
            {"kind": kind.value, "item": item.name, "user_id": str(target)}, ip,
        )
        await self._notifications.qualification_requested(actor_id, target, QUALIFICATION_KIND_TITLES[kind], item.name)
        await self._uow.commit()
        return created

    async def withdraw(self, actor_id: UUID, qualification_id: UUID, ip: str | None) -> QualificationModel:
        """Отзывает ещё не рассмотренную заявку её автором или заявленным."""
        item = await self._get(qualification_id)
        if actor_id not in (item.user_id, item.submitted_by):
            raise Forbidden()
        if item.status != S.PENDING:
            raise InvalidStatus()
        item.status = S.WITHDRAWN
        await self._audit.write(AuditAction.QUALIFICATION_WITHDRAW, actor_id, "qualification", item.id, {}, ip)
        await self._uow.commit()
        return item

    async def approve(self, actor_id: UUID, qualification_id: UUID, order_number: str, order_date: date, ip: str | None) -> QualificationModel:
        """Одобряет заявку по приказу: заменяет прежнюю ступень, выставляет срок, токен и подпись для QR-проверки."""
        item = await self._pending(qualification_id)
        if not order_number.strip():
            raise ValidationFailed(fields={"order_number": ["Укажите номер приказа"]})
        if order_date > today():
            raise ValidationFailed(fields={"order_date": ["Дата приказа из будущего"]})
        expires = self.valid_until(item, today())
        if expires is not None and expires <= today():
            raise ValidationFailed(fields={"item_id": ["Срок разряда уже истёк: спортсмен вышел из возраста юношеских разрядов"]})
        current = await self._repository.of_user(item.user_id, item.kind, S.APPROVED)
        if current:
            current.status = S.SUPERSEDED
            await self._repository.flush()
        start = today()
        item.status, item.decided_by, item.decided_at = S.APPROVED, actor_id, datetime.now(UTC)
        end = self.valid_until(item, start)
        item.valid_from, item.valid_until = start, end
        item.order_number, item.order_date = order_number.strip(), order_date
        item.token = secrets.token_urlsafe(12)
        item.signature = self.sign(item)
        until = f"{end:%d.%m.%Y}" if end else None
        await self._audit.write(
            AuditAction.QUALIFICATION_APPROVE, actor_id, "qualification", item.id,
            {"item": item.item_name, "valid_until": end.isoformat() if end else None, "order": item.order_number}, ip,
        )
        await self._notifications.qualification_decided(
            {item.user_id, item.submitted_by}, actor_id, T.QUALIFICATION_APPROVED, item.item_name, until, None,
            lambda user: link_for(item.kind, user.id == item.user_id),
        )
        await self._uow.commit()
        return item

    async def reject(self, actor_id: UUID, qualification_id: UUID, reason: str, ip: str | None) -> QualificationModel:
        """Отклоняет заявку с указанной причиной."""
        item = await self._pending(qualification_id)
        item.status, item.decided_by, item.decided_at = S.REJECTED, actor_id, datetime.now(UTC)
        item.reject_reason = reason.strip()
        await self._audit.write(
            AuditAction.QUALIFICATION_REJECT, actor_id, "qualification", item.id, {"reason": item.reject_reason}, ip
        )
        await self._notifications.qualification_decided(
            {item.user_id, item.submitted_by}, actor_id, T.QUALIFICATION_REJECTED, item.item_name, None,
            item.reject_reason, lambda user: link_for(item.kind, user.id == item.user_id),
        )
        await self._uow.commit()
        return item

    def sign(self, item: QualificationModel) -> str:
        """Подписывает квалификацию секретом приложения."""
        return signature(item, self._secret)

    async def verify(self, token: str) -> tuple[QualificationModel, bool]:
        """Находит квалификацию по токену и проверяет подпись и срок; бросает NotFound."""
        item = await self._repository.by_token(token)
        if item is None or item.signature is None:
            raise NotFound("Запись не найдена")
        return item, hmac.compare_digest(item.signature, self.sign(item))

    @staticmethod
    def valid_until(item: QualificationModel, start: date) -> date | None:
        """Считает дату окончания действия разряда или категории от start; None — если бессрочно."""
        if item.rank_type is not None:
            rank = item.rank_type
            if rank.is_lifetime or rank.validity_months is None:
                return None
            end = add_months(start, rank.validity_months)
            if rank.rank_kind == RankKind.YOUTH and rank.valid_until_age:
                end = min(end, birthday(item.user.birth_date, rank.valid_until_age))
            return end
        if item.judge_category is not None and item.judge_category.validity_months is not None:
            return add_months(start, item.judge_category.validity_months)
        return None

    async def preview(self, qualification_id: UUID) -> date | None:
        """Показывает дату окончания действия, если заявку одобрить сегодня."""
        return self.valid_until(await self._get(qualification_id), today())

    async def mine(self, user_id: UUID) -> Mine:
        """Возвращает историю разрядов и категорий пользователя и его заявки, поданные им самим."""
        return Mine(items=await self._repository.history([user_id]), submitted=await self._repository.submitted_by(user_id))

    async def queue(
        self, kind: QualificationKind | None, status: QualificationStatus | None
    ) -> Sequence[QualificationModel]:
        """Возвращает заявки на рассмотрение, отфильтрованные по виду и статусу."""
        return await self._repository.queue(kind, status)

    async def results(
        self, actor_id: UUID, roles: frozenset[Role], user_id: UUID | None
    ) -> list[tuple[ContestResultModel, ContestModel]]:
        """Возвращает места человека для основания разряда: свои или подопечного у тренера."""
        target = user_id or actor_id
        if target != actor_id:
            await self._check_submitter(actor_id, roles, K.RANK, target)
        rows = await self._repository.results(target)
        contests = await self._repository.contests([row.contest_id for row in rows])
        return [(row, contests[row.contest_id]) for row in rows if row.contest_id in contests]

    async def athletes(self, coach_id: UUID) -> Sequence[UserModel]:
        """Возвращает спортсменов, за которых тренер может подавать разряды."""
        return await self._repository.coach_athletes(coach_id)

    async def _item(self, kind: QualificationKind, item_id: int) -> DictionaryJudgeCategoryModel | DictionaryRankTypeModel | None:
        """Возвращает справочную запись разряда или категории по виду и id."""
        if kind == K.JUDGE_CATEGORY:
            return await self._dictionary.get(DictionaryJudgeCategoryModel, item_id)
        return await self._dictionary.get(DictionaryRankTypeModel, item_id)

    async def _check_submitter(self, actor_id: UUID, roles: frozenset[Role], kind: QualificationKind, target: UUID) -> None:
        """Проверяет, что actor имеет право подавать разряд или категорию за target."""
        if kind == K.JUDGE_CATEGORY:
            if target != actor_id:
                raise Forbidden("Категорию подаёт сам судья")
            user = await self._users.get(actor_id)
            if user is None or not any(r.role == Role.JUDGE and r.status == RoleStatus.VERIFIED for r in user.roles):
                raise Forbidden("Нужна подтверждённая роль судьи")
            return
        if target == actor_id:
            if Role.ATHLETE not in roles:
                raise Forbidden("Разряд подаёт спортсмен или его тренер")
            return
        if Role.COACH not in roles or target not in {user.id for user in await self._repository.coach_athletes(actor_id)}:
            raise Forbidden("Тренер подаёт разряд только за спортсменов из своих заявок")

    async def _get(self, qualification_id: UUID) -> QualificationModel:
        """Возвращает заявку по id или поднимает NotFound."""
        item = await self._repository.get(qualification_id)
        if item is None:
            raise NotFound()
        return item

    async def _pending(self, qualification_id: UUID) -> QualificationModel:
        """Возвращает заявку по id, проверяя, что она ещё на рассмотрении."""
        item = await self._get(qualification_id)
        if item.status != S.PENDING:
            raise InvalidStatus()
        return item
