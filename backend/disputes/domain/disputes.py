from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import AppError, Forbidden, InvalidStatus, NotFound, ValidationFailed
from disputes.repositories.pg_disputes import DisputeRepository
from files.domain.files import Files
from infrastructure.account.user import UserModel
from infrastructure.contests.contest import ContestModel
from infrastructure.disputes.appeal import AppealModel
from infrastructure.disputes.violation import ViolationModel
from infrastructure.enums import (
    APPEAL_STATUS_TITLES,
    SANCTION_TITLES,
    AppealStatus,
    ContestStatus,
    Role,
    Sanction,
    ViolationStatus,
)
from infrastructure.participation.contest_application import ContestApplicationModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T
from results.domain.results import Results

OPEN = (AppealStatus.SUBMITTED, AppealStatus.REVIEWING)
HELD = frozenset({ContestStatus.IN_PROGRESS, ContestStatus.COMPLETED})


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


def name(user: UserModel) -> str:
    """Фамилия и имя человека для текстов уведомлений."""
    return f"{user.last_name} {user.first_name}"


def entry_title(application: ContestApplicationModel) -> str:
    """Название заявки: команда или ФИО участника личной заявки."""
    if application.team_name:
        return f"команда «{application.team_name}»"
    member = next((item for item in application.members if item.is_active), None)
    return name(member.user) if member else f"заявка № {application.id}"


def shifted(places: dict[int, int | None], target: int, sanction: Sanction) -> list[tuple[int, int | None]]:
    """Пересчитывает места после санкции: дисквалифицированный без места, техническое поражение — последним, остальные сдвигаются вверх."""
    others = sorted((place, application_id) for application_id, place in places.items() if application_id != target and place is not None)
    result: dict[int, int | None] = {application_id: index + 1 for index, (_, application_id) in enumerate(others)}
    result.update({application_id: None for application_id, place in places.items() if application_id != target and place is None})
    result[target] = len(others) + 1 if sanction == Sanction.TECHNICAL_DEFEAT else None
    return list(result.items())


class AppealExists(AppError):
    status_code = 409
    code = "appeal_exists"
    message = "По этой заявке уже есть апелляция на рассмотрении"


class AppealClosed(AppError):
    status_code = 409
    code = "appeal_closed"
    message = "Срок подачи апелляции истёк"


@dataclass(slots=True)
class ContestDisputes:
    contest: ContestModel
    privileged: bool
    can_report: bool
    appeal_until: date
    appeals: Sequence[AppealModel]
    violations: Sequence[ViolationModel]
    entries: list[tuple[ContestApplicationModel, int | None]] = field(default_factory=list)
    participants: Sequence[tuple[int, UserModel, str | None]] = field(default_factory=list)


class Disputes:
    """Апелляции на результаты и нарушения: подача с доказательствами, решение федерации, правка мест и санкции."""

    APPEAL_DAYS = 30

    def __init__(
        self, uow: UnitOfWork, repository: DisputeRepository, files: Files, results: Results, audit: Audit, notifications: Notifications
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._repository, self._files, self._results = uow, repository, files, results
        self._audit, self._notifications = audit, notifications

    async def contest(self, actor_id: UUID, roles: frozenset[Role], contest_id: int) -> ContestDisputes:
        """Собирает апелляции и нарушения соревнования в пределах прав смотрящего и что он может подать."""
        contest = await self._held(contest_id)
        judges = await self._repository.judge_ids(contest.id)
        privileged = Role.FEDERATION in roles or contest.organizer_id == actor_id or actor_id in judges
        if privileged:
            appeals = await self._repository.appeals(contest.id)
            violations = await self._repository.violations(contest.id)
        else:
            appeals = await self._repository.appeals(contest.id, user_id=actor_id)
            violations = [item for item in await self._repository.violations(contest.id, user_id=actor_id) if item.status != ViolationStatus.REPORTED]
        can_report = Role.FEDERATION in roles or actor_id in judges
        until = contest.ends_on + timedelta(days=self.APPEAL_DAYS)
        places = await self._repository.places(contest.id)
        entries = [(item, places.get(item.id)) for item in await self._repository.entries(contest.id, actor_id) if item.id in places]
        participants = await self._repository.participants(contest.id) if can_report else []
        return ContestDisputes(contest, privileged, can_report, until, appeals, violations, entries, participants)

    async def queue(self, open_only: bool) -> tuple[Sequence[AppealModel], Sequence[ViolationModel]]:
        """Очередь федерации: апелляции и рапорты, по умолчанию только ждущие решения."""
        if open_only:
            return await self._repository.appeals(statuses=OPEN), await self._repository.violations(statuses=[ViolationStatus.REPORTED])
        return await self._repository.appeals(), await self._repository.violations()

    async def mine(self, user_id: UUID) -> tuple[Sequence[AppealModel], Sequence[ViolationModel]]:
        """Апелляции, которые подал человек или которые касаются его заявок, и решения по нарушениям о нём."""
        violations = [item for item in await self._repository.violations(user_id=user_id) if item.status != ViolationStatus.REPORTED]
        return await self._repository.appeals(user_id=user_id), violations

    async def appealable(self, user_id: UUID) -> list[tuple[ContestModel, date, list[tuple[ContestApplicationModel, int | None]]]]:
        """Соревнования, где человек может подать апелляцию сейчас: места внесены, срок не прошёл, открытой апелляции нет."""
        rows = await self._repository.appealable(user_id, list(HELD), today() - timedelta(days=self.APPEAL_DAYS))
        result: list[tuple[ContestModel, date, list[tuple[ContestApplicationModel, int | None]]]] = []
        for contest_id in dict.fromkeys(contest.id for contest, _ in rows):
            contest = next(item for item, _ in rows if item.id == contest_id)
            places = await self._repository.places(contest_id)
            entries = [
                (application, places[application.id])
                for item, application in rows
                if item.id == contest_id and application.id in places and not await self._repository.open_appeal(application.id)
            ]
            if entries:
                result.append((contest, contest.ends_on + timedelta(days=self.APPEAL_DAYS), entries))
        return result

    async def file_appeal(
        self,
        actor_id: UUID,
        contest_id: int,
        application_id: int,
        requested_place: int | None,
        reason: str,
        evidence_url: str | None,
        file_ids: Sequence[UUID],
        ip: str | None,
    ) -> AppealModel:
        """Подаёт апелляцию на место заявки: участник, автор заявки или тренер участника, в течение срока после соревнования."""
        contest = await self._held(contest_id)
        if today() > contest.ends_on + timedelta(days=self.APPEAL_DAYS):
            raise AppealClosed()
        application = await self._repository.application(application_id)
        if application is None or application.contest_id != contest.id:
            raise NotFound("Заявка не найдена")
        members = await self._repository.members(application.id)
        coaches = {coach for member in members for coach in await self._repository.coaches(member)}
        if application.created_by != actor_id and actor_id not in members and actor_id not in coaches:
            raise Forbidden("Апелляцию подаёт участник, автор заявки или тренер участника")
        places = await self._repository.places(contest.id)
        errors: dict[str, list[str]] = {}
        if application.id not in places:
            errors["application_id"] = ["Места по этой заявке ещё не внесены"]
        if not reason.strip():
            errors["reason"] = ["Опишите, с чем вы не согласны"]
        if requested_place is not None and not 1 <= requested_place <= max(len(places), 1):
            errors["requested_place"] = [f"Место от 1 до {max(len(places), 1)}"]
        files, problem = await self._files.usable(file_ids, actor_id, False, Files.ALLOWED_TYPES)
        if problem:
            errors["file_ids"] = ["Этот тип файла не подходит" if problem == "type" else problem]
        if errors:
            raise ValidationFailed(fields=errors)
        if await self._repository.open_appeal(application.id):
            raise AppealExists()
        item = AppealModel(
            contest_id=contest.id, application_id=application.id, filed_by=actor_id, current_place=places[application.id],
            requested_place=requested_place, reason=reason.strip(), evidence_url=evidence_url, status=AppealStatus.SUBMITTED, files=files,
        )
        await self._repository.add(item)
        await self._audit.write(AuditAction.APPEAL_SUBMIT, actor_id, "appeal", item.id, {"contest_id": contest.id, "application_id": application.id}, ip)
        text = f"«{contest.title}»: апелляция на результат, {entry_title(application)}."
        await self._notifications.dispute_filed(actor_id, T.APPEAL_SUBMITTED, "Новая апелляция", text, [contest.organizer_id])
        await self._uow.commit()
        return await self._repository.fresh_appeal(item.id)

    async def withdraw(self, actor_id: UUID, appeal_id: UUID, ip: str | None) -> AppealModel:
        """Отзывает свою апелляцию, пока по ней нет решения."""
        item = await self._appeal(appeal_id)
        if item.filed_by != actor_id:
            raise NotFound()
        if item.status not in OPEN:
            raise InvalidStatus()
        item.status = AppealStatus.WITHDRAWN
        await self._audit.write(AuditAction.APPEAL_WITHDRAW, actor_id, "appeal", item.id, {}, ip)
        await self._uow.commit()
        return item

    async def review(self, actor_id: UUID, appeal_id: UUID, ip: str | None) -> AppealModel:
        """Федерация берёт апелляцию на рассмотрение; участники получают уведомление."""
        item = await self._appeal(appeal_id)
        if item.status != AppealStatus.SUBMITTED:
            raise InvalidStatus()
        item.status, item.reviewer_id = AppealStatus.REVIEWING, actor_id
        await self._audit.write(AuditAction.APPEAL_REVIEW, actor_id, "appeal", item.id, {}, ip)
        await self._notify_appeal(item, actor_id, T.APPEAL_REVIEWING, "Апелляция на рассмотрении")
        await self._uow.commit()
        return item

    async def decide_appeal(
        self, actor_id: UUID, appeal_id: UUID, upheld: bool, decision: str, places: Sequence[tuple[int, int | None]], ip: str | None
    ) -> AppealModel:
        """Решение по апелляции; при удовлетворении места правятся протоколом, документы и рейтинг пересчитываются."""
        item = await self._appeal(appeal_id)
        if item.status not in OPEN:
            raise InvalidStatus()
        if not decision.strip():
            raise ValidationFailed(fields={"decision": ["Напишите обоснование решения"]})
        if upheld and not places:
            raise ValidationFailed(fields={"places": ["Укажите исправленные места"]})
        item.status = AppealStatus.UPHELD if upheld else AppealStatus.REJECTED
        item.decision, item.decided_by, item.decided_at = decision.strip(), actor_id, datetime.now(UTC)
        changes = {"status": item.status.value, "places": [list(pair) for pair in places] if upheld else []}
        await self._audit.write(AuditAction.APPEAL_DECIDE, actor_id, "appeal", item.id, changes, ip)
        await self._notify_appeal(item, actor_id, T.APPEAL_DECIDED, f"Апелляция {APPEAL_STATUS_TITLES[item.status].lower()}")
        if upheld:
            current = await self._repository.places(item.contest_id)
            merged = {**current, **dict(places)}
            await self._results.save(actor_id, True, item.contest_id, list(merged.items()), ip, f"Апелляция: {item.decision}")
        else:
            await self._uow.commit()
        return await self._repository.fresh_appeal(item.id)

    async def report(
        self,
        actor_id: UUID,
        roles: frozenset[Role],
        contest_id: int,
        user_id: UUID,
        description: str,
        evidence_url: str | None,
        file_ids: Sequence[UUID],
        ip: str | None,
    ) -> ViolationModel:
        """Рапорт о нарушении участника: подаёт судья коллегии или федерация, решение принимает федерация."""
        contest = await self._held(contest_id)
        federation = Role.FEDERATION in roles
        if not federation and actor_id not in await self._repository.judge_ids(contest.id):
            raise Forbidden("Рапорт подаёт судья коллегии соревнования или федерация")
        application_id = await self._repository.membership(contest.id, user_id)
        errors: dict[str, list[str]] = {}
        if application_id is None:
            errors["user_id"] = ["Человек не участвует в этом соревновании"]
        if not description.strip():
            errors["description"] = ["Опишите нарушение"]
        files, problem = await self._files.usable(file_ids, actor_id, federation, Files.ALLOWED_TYPES)
        if problem:
            errors["file_ids"] = ["Этот тип файла не подходит" if problem == "type" else problem]
        if errors or application_id is None:
            raise ValidationFailed(fields=errors)
        item = ViolationModel(
            contest_id=contest.id, application_id=application_id, user_id=user_id, reported_by=actor_id,
            description=description.strip(), evidence_url=evidence_url, status=ViolationStatus.REPORTED, files=files,
        )
        await self._repository.add(item)
        await self._audit.write(AuditAction.VIOLATION_REPORT, actor_id, "violation", item.id, {"contest_id": contest.id, "user_id": str(user_id)}, ip)
        await self._notifications.dispute_filed(actor_id, T.VIOLATION_REPORTED, "Рапорт о нарушении", f"«{contest.title}»: рапорт о нарушении, ждёт решения федерации.", [])
        await self._uow.commit()
        return await self._repository.fresh_violation(item.id)

    async def decide_violation(
        self, actor_id: UUID, violation_id: UUID, sanction: Sanction | None, decision: str, suspended_until: date | None, ip: str | None
    ) -> ViolationModel:
        """Решение по нарушению: без санкции, предупреждение, техническое поражение, дисквалификация или отстранение до даты."""
        item = await self._repository.violation(violation_id)
        if item is None:
            raise NotFound()
        if item.status != ViolationStatus.REPORTED:
            raise InvalidStatus()
        errors: dict[str, list[str]] = {}
        if not decision.strip():
            errors["decision"] = ["Напишите обоснование решения"]
        if sanction == Sanction.SUSPENSION and (suspended_until is None or suspended_until <= today()):
            errors["suspended_until"] = ["Отстранение — до даты позже сегодняшней"]
        places = await self._repository.places(item.contest_id)
        moves = sanction in (Sanction.TECHNICAL_DEFEAT, Sanction.DISQUALIFICATION)
        if moves and item.application_id not in places:
            errors["sanction"] = ["Места ещё не внесены: сначала внесите места в протокол"]
        if errors:
            raise ValidationFailed(fields=errors)
        item.status = ViolationStatus.DECIDED if sanction else ViolationStatus.DISMISSED
        item.sanction, item.decision = sanction, decision.strip()
        until = suspended_until if sanction == Sanction.SUSPENSION else None
        item.suspended_until = until
        item.decided_by, item.decided_at = actor_id, datetime.now(UTC)
        payload = {"sanction": sanction.value if sanction else None, "suspended_until": until.isoformat() if until else None}
        await self._audit.write(AuditAction.VIOLATION_DECIDE, actor_id, "violation", item.id, payload, ip)
        if sanction:
            text = f"«{item.contest.title}»: {SANCTION_TITLES[sanction].lower()}"
            if until:
                text += f" до {until.strftime('%d.%m.%Y')}. На это время нет рейтинга, сборной и новых заявок"
            await self._notifications.dispute([item.user_id], actor_id, T.VIOLATION_DECIDED, "Решение по нарушению", text + ".", "/cabinet/athlete/disputes")
            coaches = await self._repository.coaches(item.user_id)
            await self._notifications.dispute(coaches, actor_id, T.VIOLATION_DECIDED, "Решение по нарушению спортсмена", f"{name(item.user)}: {text}.", "/cabinet/coach/disputes")
        if moves and sanction:
            await self._results.save(actor_id, True, item.contest_id, shifted(places, item.application_id, sanction), ip, f"Нарушение: {SANCTION_TITLES[sanction]}")
        else:
            await self._uow.commit()
        return await self._repository.fresh_violation(item.id)

    async def _held(self, contest_id: int) -> ContestModel:
        """Возвращает идущее или завершённое соревнование; иначе NotFound или InvalidStatus."""
        contest = await self._repository.contest(contest_id)
        if contest is None:
            raise NotFound()
        if contest.status not in HELD:
            raise InvalidStatus("Апелляции и нарушения — только у идущих и завершённых соревнований")
        return contest

    async def _appeal(self, appeal_id: UUID) -> AppealModel:
        """Возвращает апелляцию или бросает NotFound."""
        item = await self._repository.appeal(appeal_id)
        if item is None:
            raise NotFound()
        return item

    async def _notify_appeal(self, item: AppealModel, actor_id: UUID, kind: T, title: str) -> None:
        """Сообщает о ходе апелляции подавшему и участникам заявки."""
        text = f"«{item.contest.title}», {entry_title(item.application)}: {APPEAL_STATUS_TITLES[item.status].lower()}."
        if item.decision:
            text += f" {item.decision}"
        members = await self._repository.members(item.application_id)
        await self._notifications.dispute(members, actor_id, kind, title, text, "/cabinet/athlete/disputes")
        if item.filed_by not in members:
            await self._notifications.dispute([item.filed_by], actor_id, kind, title, text, "/cabinet/coach/disputes")
