from collections.abc import Callable, Iterable
from datetime import UTC, datetime, timedelta
from urllib.parse import unquote, urlsplit
from uuid import UUID

from auth.repositories.pg_users import UserRepository
from core.config import Settings
from core.database import UnitOfWork
from core.errors import NotFound
from infrastructure.enums import Channel, EmailStatus, Role, RoleStatus
from infrastructure.notifications.notification import NotificationModel
from infrastructure.notifications.outbox import OutboxModel
from infrastructure.account.user import UserModel
from notifications.domain.types import GROUP_LABELS, GROUPS, NotificationGroup
from notifications.domain.types import NotificationType as T
from notifications.repositories.pg_notification_settings import NotificationSettingRepository
from notifications.repositories.pg_notifications import NotificationRepository
from notifications.repositories.pg_outbox import OutboxRepository
from notifications.repositories.pg_telegram_links import TelegramLinkRepository

Link = str | Callable[[UserModel], str] | None
CODE_LETTERS = {
    T.AUTH_PASSWORD_RESET: ("Код для сброса пароля",
                            "Введите этот код на странице восстановления доступа. "
                            "Если вы не запрашивали сброс пароля, ничего не делайте: пароль не изменится."),
    T.AUTH_EMAIL_VERIFY: ("Подтвердите почту", "Введите этот код в личном кабинете, чтобы подтвердить почту."),
    T.AUTH_EMAIL_CHANGE: ("Подтвердите новую почту",
                          "Введите этот код в настройках кабинета, чтобы привязать эту почту к аккаунту ФСП."),
}


def _name(user: UserModel | None) -> str:
    """Возвращает «Фамилия Имя» пользователя или заглушку, если его нет."""
    return f"{user.last_name} {user.first_name}" if user else "Пользователь"


def _with_reason(text: str, reason: str | None) -> str:
    """Добавляет к тексту причину, если она указана."""
    return f"{text} Причина: {reason.strip()}" if reason and reason.strip() else text


def _check(kind: str, title: str, link: str | None) -> None:
    """Проверяет тип, заголовок и что ссылка — безопасный внутренний путь."""
    if not kind or len(kind) > 100 or not title.strip() or len(title) > 200:
        raise ValueError("Invalid notification type or title")
    if link is None:
        return
    decoded = unquote(link)
    if (not link.startswith("/") or decoded.startswith("//") or "\\" in decoded or len(link) > 1000
            or any(ord(char) < 32 for char in decoded) or urlsplit(link).netloc):
        raise ValueError("Notification link must be an internal path")


class Notifications:
    """Уведомления пользователей: отправка во все каналы, настройки и инбокс."""

    EMAIL_TYPES = frozenset({
        T.ROLE_APPROVED, T.ROLE_REJECTED, T.ROLE_RESET,
        T.CONTEST_VERIFIED, T.CONTEST_VERIFICATION_REJECTED, T.CONTEST_VERIFICATION_REVOKED, T.CONTEST_CANCELLED,
        T.APPLICATION_APPROVED, T.APPLICATION_REJECTED, T.APPLICATION_RESET,
        T.AUTH_PASSWORD_CHANGED, T.AUTH_NEW_DEVICE, T.AUTH_EMAIL_CHANGED, T.SYSTEM_TEST,
        T.QUALIFICATION_APPROVED, T.QUALIFICATION_REJECTED, T.QUALIFICATION_EXPIRING, T.QUALIFICATION_EXPIRED,
        T.JUDGE_ASSIGNED, T.JUDGE_REMOVED, T.CONSENT_APPROVED, T.CONSENT_REJECTED, T.SQUAD_INCLUDED,
        T.COACH_LINK_REQUESTED, T.COACH_LINK_DECIDED, T.DEADLINE_REGISTRATION, T.DEADLINE_GOVERNOR,
        T.DEADLINE_REPORT, T.ANTIDOPING_EXPIRING, T.RANK_POSSIBLE, T.APPEAL_DECIDED, T.VIOLATION_DECIDED,
        T.TRAINING_ATTESTATION,
    })
    ROLE_LABELS = {Role.ATHLETE: "Спортсмен", Role.COACH: "Тренер", Role.JUDGE: "Судья",
                   Role.ORGANIZER: "Организатор", Role.FEDERATION: "Сотрудник федерации"}

    def __init__(self, repository: NotificationRepository, outbox: OutboxRepository, users: UserRepository,
                 preferences: NotificationSettingRepository, telegram: TelegramLinkRepository,
                 uow: UnitOfWork, settings: Settings) -> None:
        """Сохраняет зависимости."""
        self._repository, self._outbox, self._users = repository, outbox, users
        self._preferences, self._telegram, self._uow, self._settings = preferences, telegram, uow, settings

    async def notify(self, user_id: UUID, type: str, title: str, text: str, link: str | None = None) -> None:
        """Отправляет произвольное уведомление пользователю во все доступные каналы."""
        await self._send(user_id, type, title, text, link)

    async def code(self, user_id: UUID, address: str, kind: T, code: str) -> None:
        """Ставит в очередь письмо с кодом подтверждения на указанный адрес."""
        title, text = CODE_LETTERS[kind]
        await self._outbox.add(OutboxModel(
            channel=Channel.EMAIL, user_id=user_id, type=kind, recipient=address, title=title, text=text, code=code,
            expires_at=datetime.now(UTC) + timedelta(seconds=self._settings.code_ttl_seconds)))

    async def security(self, user_id: UUID, kind: T, title: str, text: str, old_address: str | None = None) -> None:
        """Отправляет уведомление безопасности пользователю и, если задан, на старую почту."""
        await self._send(user_id, kind, title, text, "/forgot-password")
        if old_address:
            await self._outbox.add(OutboxModel(channel=Channel.EMAIL, user_id=user_id, type=kind, recipient=old_address,
                                               title=title, text=text, link="/forgot-password"))

    async def test(self, user_id: UUID) -> None:
        """Отправляет тестовое уведомление во все подключённые каналы."""
        await self._send(user_id, T.SYSTEM_TEST, "Проверка доставки",
                         "Это тестовое уведомление. Оно пришло во все подключённые каналы: кабинет, почту и Telegram.",
                         "/cabinet")
        await self._uow.commit()

    async def preferences(self, user_id: UUID) -> list[tuple[NotificationGroup, str, str, bool, bool, bool]]:
        """Возвращает настройки уведомлений по группам: включённость email/Telegram и блокировку группы."""
        disabled = await self._preferences.disabled(user_id)
        return [(group, label, description, (group, Channel.EMAIL) not in disabled,
                 (group, Channel.TELEGRAM) not in disabled, group == NotificationGroup.SECURITY)
                for group, (label, description) in GROUP_LABELS.items()]

    async def set_preferences(self, user_id: UUID, values: Iterable[tuple[NotificationGroup, Channel, bool]]) -> None:
        """Включает или выключает каналы уведомлений по группам; группу безопасности не трогает."""
        current = await self._preferences.disabled(user_id)
        for group, channel, enabled in values:
            if group == NotificationGroup.SECURITY:
                continue
            if enabled:
                current.discard((group, channel))
            else:
                current.add((group, channel))
        await self._preferences.replace(user_id, current)
        await self._uow.commit()

    async def role_requested(self, user_id: UUID, role: Role) -> None:
        """Уведомляет сотрудников федерации о новой заявке на роль."""
        text = f"{_name(await self._users.get(user_id))} запрашивает роль «{self.ROLE_LABELS[role]}»."
        for recipient in await self._users.active_federation_ids(user_id):
            await self._send(recipient, T.ROLE_REQUESTED, "Новая заявка на роль", text, "/cabinet/federation/accounts")

    async def role_decided(self, user_id: UUID, actor_id: UUID, role: Role, kind: T, reason: str | None) -> None:
        """Уведомляет пользователя о решении по его заявке на роль."""
        label = self.ROLE_LABELS[role]
        title, text, link = {
            T.ROLE_APPROVED: ("Роль подтверждена", f"Федерация подтвердила роль «{label}». Кабинет открыт.", f"/cabinet/{role}"),
            T.ROLE_REJECTED: ("В роли отказано", f"Федерация отклонила заявку на роль «{label}».", "/cabinet"),
            T.ROLE_RESET: ("Роль возвращена на проверку", f"Роль «{label}» снова на проверке у федерации.", "/cabinet"),
        }[kind]
        for recipient in self._unique([user_id], actor_id):
            await self._send(recipient, kind, title, _with_reason(text, reason), link)

    async def consent_submitted(self, user_id: UUID) -> None:
        """Уведомляет сотрудников федерации о новом согласии законного представителя."""
        text = f"{_name(await self._users.get(user_id))} прислал(а) согласие законного представителя."
        for recipient in await self._users.active_federation_ids(user_id):
            await self._send(recipient, T.CONSENT_SUBMITTED, "Согласие на проверку", text,
                             "/cabinet/federation/accounts?role=consents")

    async def consent_decided(self, user_id: UUID, actor_id: UUID, kind: T, reason: str | None) -> None:
        """Уведомляет пользователя о решении по согласию законного представителя."""
        title, text = {
            T.CONSENT_APPROVED: ("Согласие одобрено", "Федерация одобрила согласие законного представителя. Можно подавать заявки."),
            T.CONSENT_REJECTED: ("Согласие отклонено", "Федерация отклонила согласие законного представителя. Загрузите новое."),
        }[kind]
        for recipient in self._unique([user_id], actor_id):
            await self._send(recipient, kind, title, _with_reason(text, reason), "/cabinet/athlete/settings")

    async def qualification_requested(self, actor_id: UUID, user_id: UUID, kind_title: str, item: str) -> None:
        """Уведомляет сотрудников федерации о новой заявке на разряд или категорию."""
        text = f"{_name(await self._users.get(user_id))}: {kind_title.lower()} «{item}». Нужно решение федерации."
        for recipient in await self._users.active_federation_ids(actor_id):
            await self._send(recipient, T.QUALIFICATION_REQUESTED, "Заявка на разряд или категорию", text,
                             "/cabinet/federation/qualifications")

    async def qualification_decided(self, recipients: Iterable[UUID], actor_id: UUID, kind: T, item: str,
                                    valid_until: str | None, reason: str | None, link: Link) -> None:
        """Уведомляет получателей о присвоении или отказе в разряде/категории."""
        if kind == T.QUALIFICATION_APPROVED:
            title = "Присвоено решением федерации"
            text = f"«{item}» присвоено. " + (f"Действует до {valid_until}." if valid_until else "Бессрочно.")
        else:
            title, text = "Отказано федерацией", _with_reason(f"Федерация отказала: «{item}».", reason)
        for recipient in self._unique(recipients, actor_id):
            await self._send(recipient, kind, title, text, link)

    async def qualification_expiring(self, user_id: UUID, item: str, valid_until: str, days: int, link: str) -> None:
        """Уведомляет об истёкшем или скоро истекающем сроке разряда/категории."""
        if days <= 0:
            await self._send(user_id, T.QUALIFICATION_EXPIRED, "Срок истёк",
                             f"Срок «{item}» истёк {valid_until}. Подайте заявку заново.", link)
            return
        await self._send(user_id, T.QUALIFICATION_EXPIRING, "Скоро истекает срок",
                         f"«{item}» действует до {valid_until}, осталось {days} дн. Подайте заявку на подтверждение.", link)

    async def qualification_expiring_watchers(self, user_id: UUID, coach_ids: Iterable[UUID], item: str, valid_until: str, days: int) -> None:
        """Предупреждает тренеров спортсмена и федерацию об истекающем или истёкшем разряде или категории."""
        owner = await self._users.get(user_id)
        who = _name(owner) if owner else "Спортсмен"
        state = f"истёк {valid_until}" if days <= 0 else f"действует до {valid_until}, осталось {days} дн."
        kind = T.QUALIFICATION_EXPIRED if days <= 0 else T.QUALIFICATION_EXPIRING
        for coach in self._unique(coach_ids, user_id):
            await self._send(coach, kind, "Срок разряда спортсмена", f"{who}: «{item}» {state}", "/cabinet/coach/ranks")
        for recipient in await self._users.active_federation_ids(user_id):
            await self._send(recipient, kind, "Истекает разряд или категория", f"{who}: «{item}» {state}", "/cabinet/federation/qualifications")

    async def judge_assignment(self, judge_id: UUID, actor_id: UUID, kind: T, contest: str, position: str) -> None:
        """Уведомляет судью о назначении на соревнование или снятии с него."""
        title, text = {
            T.JUDGE_ASSIGNED: ("Назначение в судейскую коллегию", f"«{contest}»: вы назначены, должность «{position}»."),
            T.JUDGE_REMOVED: ("Снятие с судейства", f"«{contest}»: вы сняты с должности «{position}»."),
        }[kind]
        for recipient in self._unique([judge_id], actor_id):
            await self._send(recipient, kind, title, text, "/cabinet/judge/assignments")

    async def squad_included(self, members: Iterable[tuple[UUID, bool]], actor_id: UUID, title: str, link: str) -> None:
        """Уведомляет участников о включении в сборную или её резерв."""
        for user_id, is_reserve in members:
            if user_id == actor_id:
                continue
            text = f"Поздравляем! Вы вошли в {'резерв сборной' if is_reserve else 'сборную'} {title}."
            await self._send(user_id, T.SQUAD_INCLUDED, "Вы в сборной", text, link)

    async def coach_link(self, recipient_id: UUID, actor_id: UUID, kind: T, title: str, text: str, link: str) -> None:
        """Уведомляет второго участника связи тренер ↔ спортсмен о её изменении."""
        for recipient in self._unique([recipient_id], actor_id):
            await self._send(recipient, kind, title, text, link)

    async def training(self, recipients: Iterable[UUID], actor_id: UUID, kind: T, title: str, text: str, link: str) -> None:
        """Сообщает спортсмену и тренерам о зачислении, переводе, отчислении или итогах аттестации."""
        for recipient in self._unique(recipients, actor_id):
            await self._send(recipient, kind, title, text, link)

    async def deadline(self, user_id: UUID, kind: T, title: str, text: str, link: str) -> None:
        """Отправляет напоминание о сроке."""
        await self._send(user_id, kind, title, text, link)

    async def dispute_filed(self, actor_id: UUID, kind: T, title: str, text: str, also: Iterable[UUID]) -> None:
        """Сообщает федерации и указанным людям о новой апелляции или рапорте о нарушении."""
        federation = await self._users.active_federation_ids(actor_id)
        for recipient in self._unique([*federation, *also], actor_id):
            link = "/cabinet/federation/disputes" if recipient in federation else "/cabinet/organizer/competitions"
            await self._send(recipient, kind, title, text, link)

    async def dispute(self, recipients: Iterable[UUID], actor_id: UUID, kind: T, title: str, text: str, link: str) -> None:
        """Сообщает участникам о ходе рассмотрения апелляции или о решении по нарушению."""
        for recipient in self._unique(recipients, actor_id):
            await self._send(recipient, kind, title, text, link)

    async def contest_verification_requested(self, actor_id: UUID, title: str, edited: bool) -> None:
        """Уведомляет сотрудников федерации о запросе верификации соревнования."""
        text = (f"«{title}»: изменены поля, влияющие на рейтинг. Нужна повторная верификация." if edited
                else f"«{title}»: организатор запросил верификацию.")
        for recipient in await self._users.active_federation_ids(actor_id):
            await self._send(recipient, T.CONTEST_VERIFICATION_REQUESTED, "Соревнование ждёт верификации", text,
                             "/cabinet/federation/competitions?tab=queue")

    async def contest_verification(self, organizer_id: UUID, actor_id: UUID, kind: T, title: str,
                                   reason: str | None = None) -> None:
        """Уведомляет организатора о решении по верификации соревнования."""
        heading, text = {
            T.CONTEST_VERIFIED: ("Соревнование верифицировано", f"«{title}» верифицировано. Места дают баллы в рейтинг."),
            T.CONTEST_VERIFICATION_REJECTED: ("Отказ в верификации", f"«{title}»: федерация отказала в верификации."),
            T.CONTEST_VERIFICATION_REVOKED: ("Верификация снята", f"С «{title}» снята верификация. Баллы за места не идут в рейтинг."),
        }[kind]
        for recipient in self._unique([organizer_id], actor_id):
            await self._send(recipient, kind, heading, _with_reason(text, reason),
                             lambda user: self._cabinet(user, "competitions"))

    async def contest_cancelled(self, user_ids: Iterable[UUID], actor_id: UUID, contest_id: int, title: str,
                                reason: str | None) -> None:
        """Уведомляет участников об отмене соревнования."""
        for recipient in self._unique(user_ids, actor_id):
            await self._send(recipient, T.CONTEST_CANCELLED, "Соревнование отменено",
                             _with_reason(f"«{title}» отменено.", reason), f"/competitions/{contest_id}")

    async def application_invited(self, user_ids: Iterable[UUID], actor_id: UUID, contest: str,
                                  team: str | None, by_coach: bool) -> None:
        """Уведомляет приглашённых участников о записи тренером или приглашении в команду."""
        name = _name(await self._users.get(actor_id))
        if by_coach:
            title = "Вас записали на соревнование"
            place = f"в команду «{team}» на «{contest}»" if team else f"на «{contest}»"
            text = f"Вас записали {place}. Тренер: {name}. Подтвердите участие."
        else:
            title = "Приглашение в команду"
            text = f"{name} приглашает вас в команду «{team}» на «{contest}». Подтвердите участие."
        for recipient in self._unique(user_ids, actor_id):
            await self._send(recipient, T.APPLICATION_INVITED, title, text, "/cabinet/athlete/competitions")

    async def application_member_declined(self, manager_id: UUID, manager_role: Role, actor_id: UUID,
                                          contest: str) -> None:
        """Уведомляет тренера или организатора об отказе участника от участия."""
        text = f"{_name(await self._users.get(actor_id))} не будет участвовать в «{contest}»."
        for recipient in self._unique([manager_id], actor_id):
            await self._send(recipient, T.APPLICATION_MEMBER_DECLINED, "Участник отказался", text,
                             f"/cabinet/{manager_role}/competitions")

    async def application_submitted(self, organizer_id: UUID, actor_id: UUID, contest: str, applicant: str) -> None:
        """Уведомляет организатора о новой заявке на участие."""
        for recipient in self._unique([organizer_id], actor_id):
            await self._send(recipient, T.APPLICATION_SUBMITTED, "Новая заявка",
                             f"На «{contest}» подана заявка: {applicant}.",
                             lambda user: self._cabinet(user, "competitions"))

    async def application_decided(self, recipients: Iterable[tuple[UUID, Role]], actor_id: UUID, kind: T,
                                  contest: str, reason: str | None) -> None:
        """Уведомляет участников заявки о решении по ней."""
        title, text = {
            T.APPLICATION_APPROVED: ("Заявка одобрена", f"Заявка на «{contest}» одобрена."),
            T.APPLICATION_REJECTED: ("Заявка отклонена", f"Заявка на «{contest}» отклонена."),
            T.APPLICATION_RESET: ("Заявка снова на рассмотрении",
                                  f"Решение по заявке на «{contest}» отменено. Заявка снова на рассмотрении."),
        }[kind]
        roles: dict[UUID, Role] = {}
        for user_id, role in recipients:
            roles.setdefault(user_id, role)
        for recipient in self._unique(roles, actor_id):
            await self._send(recipient, kind, title, _with_reason(text, reason), f"/cabinet/{roles[recipient]}/competitions")

    async def results_entered(self, places: Iterable[tuple[UUID, int | None]], actor_id: UUID, contest_id: int,
                              title: str) -> None:
        """Уведомляет участников о внесённых местах соревнования."""
        for user_id, place in places:
            if user_id == actor_id:
                continue
            text = f"«{title}»: {place} место." if place is not None else f"«{title}»: дисквалификация."
            await self._send(user_id, T.RESULTS_ENTERED, "Внесены результаты", text, f"/competitions/{contest_id}")

    async def list(self, user_id: UUID, unread_only: bool, limit: int, offset: int) -> tuple[list[NotificationModel], int]:
        """Возвращает страницу уведомлений пользователя, опционально только непрочитанных."""
        return await self._repository.list(user_id, unread_only, limit, offset)

    async def unread_count(self, user_id: UUID) -> int:
        """Возвращает количество непрочитанных уведомлений пользователя."""
        return await self._repository.unread_count(user_id)

    async def read(self, user_id: UUID, notification_id: UUID) -> None:
        """Отмечает уведомление прочитанным; 404, если его нет у пользователя."""
        if not await self._repository.read(user_id, notification_id):
            raise NotFound()
        await self._uow.commit()

    async def read_all(self, user_id: UUID) -> None:
        """Отмечает все уведомления пользователя прочитанными."""
        await self._repository.read_all(user_id)
        await self._uow.commit()

    @staticmethod
    def _unique(user_ids: Iterable[UUID], actor_id: UUID) -> tuple[UUID, ...]:
        """Убирает дубли и исключает из списка получателей самого исполнителя действия."""
        return tuple(user_id for user_id in dict.fromkeys(user_ids) if user_id != actor_id)

    @staticmethod
    def _cabinet(user: UserModel, section: str) -> str:
        """Строит ссылку на раздел кабинета по верифицированной роли организатора или федерации."""
        verified = {item.role for item in user.roles if item.status == RoleStatus.VERIFIED}
        role = next((role for role in (Role.ORGANIZER, Role.FEDERATION) if role in verified), None)
        return f"/cabinet/{role}/{section}" if role else "/cabinet"

    async def _send(self, user_id: UUID, kind: str, title: str, text: str, link: Link) -> None:
        """Создаёт запись в инбоксе и ставит в очередь письмо и/или Telegram-сообщение по настройкам."""
        user = await self._users.get(user_id)
        if user is None or not user.is_active:
            return
        path = link(user) if callable(link) else link
        _check(kind, title, path)
        group = GROUPS.get(kind, NotificationGroup.SECURITY)
        locked = group == NotificationGroup.SECURITY
        disabled = set() if locked else await self._preferences.disabled(user.id)
        email = (kind in self.EMAIL_TYPES and (locked or user.email_verified_at is not None)
                 and (group, Channel.EMAIL) not in disabled)
        item = await self._repository.add(NotificationModel(user_id=user.id, type=kind, title=title, text=text, link=path,
            email_status=EmailStatus.PENDING if email else EmailStatus.NOT_REQUIRED))
        if email:
            await self._outbox.add(OutboxModel(channel=Channel.EMAIL, notification_id=item.id, user_id=user.id,
                type=kind, recipient=user.email, title=title, text=text, link=path))
        telegram = await self._telegram.by_user(user.id)
        if telegram and (group, Channel.TELEGRAM) not in disabled:
            await self._outbox.add(OutboxModel(channel=Channel.TELEGRAM, notification_id=item.id, user_id=user.id,
                type=kind, recipient=str(telegram.chat_id), title=title, text=text, link=path))
