from dataclasses import dataclass
from html import escape
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

from applications.domain.applications import Applications
from auth.domain.roles import Roles
from auth.repositories.pg_users import UserRepository
from contests.repositories.pg_contests import ContestQuery, ContestRepository
from core.config import Settings
from core.database import UnitOfWork
from core.errors import AppError
from infrastructure.enums import (
    APPLICATION_STATUS_TITLES,
    CONTEST_STATUS_TITLES,
    ApplicationCreator,
    Channel,
    ContestStatus,
    EmailStatus,
    MemberConfirmation,
    RoleStatus,
)
from infrastructure.notifications.outbox import OutboxModel
from infrastructure.account.user import UserModel
from notifications.domain.bot_admins import BotAdmins
from notifications.domain.notifications import Notifications
from notifications.domain.telegram import Telegram
from notifications.domain.types import NotificationGroup
from notifications.repositories.pg_bot_stats import BotStatsRepository
from notifications.repositories.pg_notifications import NotificationRepository
from notifications.repositories.pg_outbox import OutboxRepository
from notifications.repositories.red_telegram_state import TelegramStateRepository
from notifications.clients.telegram import Buttons

MENU_INBOX, MENU_APPLICATIONS, MENU_CONTESTS, MENU_SETTINGS, MENU_ADMIN = (
    "Уведомления", "Мои заявки", "Соревнования", "Настройки", "Панель федерации")
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0"})
UPCOMING = frozenset({ContestStatus.PUBLISHED, ContestStatus.REGISTRATION_OPEN, ContestStatus.REGISTRATION_CLOSED,
                      ContestStatus.IN_PROGRESS})
COMMANDS = [("start", "Меню"), ("status", "Непрочитанные уведомления"), ("my", "Мои заявки"),
            ("calendar", "Ближайшие соревнования"), ("settings", "Что присылать в Telegram"),
            ("admin", "Панель федерации"), ("cancel", "Отменить действие"), ("unlink", "Отвязать аккаунт")]


@dataclass
class Reply:
    text: str
    buttons: Buttons | None = None
    keyboard: list[list[str]] | None = None
    edit: bool = False
    toast: str | None = None


def _name(user: UserModel) -> str:
    """Возвращает экранированное «Фамилия Имя» пользователя для HTML-сообщения."""
    return escape(f"{user.last_name} {user.first_name}")


def _error(error: AppError) -> str:
    """Собирает экранированный текст ошибки с деталями по полям."""
    details = [message for messages in (error.fields or {}).values() for message in messages]
    return escape(" ".join([error.message, *details]))


class BotDialog:
    """Обработка сообщений и callback-кнопок Telegram-бота: меню, уведомления, модерация."""

    def __init__(self, telegram: Telegram, admins: BotAdmins, state: TelegramStateRepository,
                 users: UserRepository, inbox: NotificationRepository, notifications: Notifications,
                 outbox: OutboxRepository, stats: BotStatsRepository, roles: Roles, applications: Applications,
                 contests: ContestRepository, uow: UnitOfWork, settings: Settings) -> None:
        """Сохраняет зависимости."""
        self._telegram, self._admins, self._state, self._users = telegram, admins, state, users
        self._inbox, self._notifications, self._outbox, self._stats = inbox, notifications, outbox, stats
        self._roles, self._applications, self._contests = roles, applications, contests
        self._uow, self._settings = uow, settings

    async def message(self, message: dict[str, Any]) -> list[Reply]:
        """Обрабатывает входящее текстовое сообщение бота: команды, пункты меню, ввод состояния."""
        chat_id = message["chat"]["id"]
        text = (message.get("text") or "").strip()
        command, _, argument = text.partition(" ")
        command = command.split("@")[0].lower()
        if command == "/start" and argument:
            return [Reply(await self._telegram.link(chat_id, argument.strip(), message.get("from", {}).get("username")))] \
                + await self._menu(chat_id, greeting=False)
        user = await self._telegram.user(chat_id)
        if user is None:
            return [Reply(self._telegram.help(linked=False))]
        if command in ("/cancel", "отмена"):
            await self._state.clear(chat_id)
            return [Reply("Действие отменено.")]
        if command == "/unlink":
            return [Reply(await self._telegram.unlink_chat(chat_id))]
        routes = {
            "/start": self._menu, "/help": self._menu,
            "/status": self._inbox_view, MENU_INBOX.lower(): self._inbox_view,
            "/my": self._applications_view, MENU_APPLICATIONS.lower(): self._applications_view,
            "/calendar": self._contests_view, MENU_CONTESTS.lower(): self._contests_view,
            "/settings": self._settings_view, MENU_SETTINGS.lower(): self._settings_view,
            "/admin": self._admin_view, MENU_ADMIN.lower(): self._admin_view,
        }
        handler = routes.get(command) or routes.get(text.lower())
        if handler:
            await self._state.clear(chat_id)
            return await handler(chat_id)
        state = await self._state.get(chat_id)
        if state and text:
            return await self._continue(chat_id, user, state, text)
        return await self._menu(chat_id)

    async def callback(self, query: dict[str, Any]) -> list[Reply]:
        """Обрабатывает нажатие inline-кнопки по её коду."""
        chat_id = query["message"]["chat"]["id"]
        data: str = query.get("data") or ""
        user = await self._telegram.user(chat_id)
        if user is None:
            return [Reply(self._telegram.help(linked=False), toast="Аккаунт не привязан")]
        kind, _, rest = data.partition(":")
        try:
            if kind == "n":
                return await self._read(chat_id, user, rest)
            if kind == "s":
                return await self._toggle(chat_id, user, NotificationGroup(rest))
            if kind == "a":
                return await self._answer_invite(user, rest)
            if kind == "adm":
                return await self._admin_action(chat_id, user, rest)
            if kind == "r":
                return await self._decide_role(chat_id, user, rest)
            if kind == "b":
                return await self._broadcast_decision(chat_id, user, rest)
        except AppError as error:
            await self._uow.rollback()
            return [Reply(_error(error), toast="Не получилось")]
        return [Reply("Кнопка устарела. Откройте меню заново.", toast="Кнопка устарела")]

    async def _menu(self, chat_id: int, greeting: bool = True) -> list[Reply]:
        """Строит главное меню с клавиатурой и числом непрочитанных уведомлений."""
        user = await self._telegram.user(chat_id)
        if user is None:
            return [Reply(self._telegram.help(linked=False))]
        keyboard = [[MENU_INBOX, MENU_APPLICATIONS], [MENU_CONTESTS, MENU_SETTINGS]]
        level = await self._admins.level(user.id)
        if level:
            keyboard.append([MENU_ADMIN])
        unread = await self._inbox.unread_count(user.id)
        text = f"<b>{_name(user)}</b>, непрочитанных уведомлений: <b>{unread}</b>." if greeting else "Меню внизу экрана."
        if level:
            text += f"\nВы {BotAdmins.LEVEL_LABELS[level].lower()} бота: «{MENU_ADMIN}»."
        return [Reply(text, keyboard=keyboard)]

    async def _inbox_view(self, chat_id: int) -> list[Reply]:
        """Показывает последние непрочитанные уведомления с кнопкой «Прочитать все»."""
        user = await self._require(chat_id)
        unread = await self._inbox.unread_count(user.id)
        if not unread:
            return [Reply("Непрочитанных уведомлений нет.", self._open_row("/cabinet"))]
        items, _ = await self._inbox.list(user.id, True, 5, 0)
        lines = [f"Непрочитанных: <b>{unread}</b>", ""]
        lines += [f"• <b>{escape(item.title)}</b>\n{escape(item.text)}" for item in items]
        if unread > len(items):
            lines.append(f"\nИ ещё {unread - len(items)} в кабинете.")
        return [Reply("\n".join(lines), [[("Прочитать все", "n:all")], *self._open_row("/cabinet")])]

    async def _read(self, chat_id: int, user: UserModel, rest: str) -> list[Reply]:
        """Отмечает прочитанным одно уведомление или все сразу."""
        if rest == "all":
            await self._inbox.read_all(user.id)
            await self._uow.commit()
            return [Reply("Все уведомления прочитаны.", edit=True, toast="Готово")]
        await self._inbox.read(user.id, UUID(rest.removeprefix("read:")))
        await self._uow.commit()
        return [Reply("", toast="Отмечено прочитанным")]

    async def _applications_view(self, chat_id: int) -> list[Reply]:
        """Показывает заявки пользователя как спортсмена и тренера с кнопками подтверждения приглашений."""
        user = await self._require(chat_id)
        own = await self._applications.mine(user.id, ApplicationCreator.ATHLETE)
        coached = await self._applications.mine(user.id, ApplicationCreator.COACH)
        if not own and not coached:
            return [Reply("Заявок пока нет. Записаться можно на сайте в разделе «Соревнования».",
                          self._open_row("/competitions"))]
        lines, buttons = ["<b>Мои заявки</b>"], []
        for item in [*own, *coached][:10]:
            team = f", команда «{escape(item.team_name)}»" if item.team_name else ""
            mine = next((member for member in item.members if member.user_id == user.id), None)
            invited = mine is not None and mine.is_active and mine.confirmation == MemberConfirmation.INVITED
            status = "ждёт вашего подтверждения" if invited else APPLICATION_STATUS_TITLES[item.status].lower()
            lines.append(f"\n• <b>{escape(item.contest.title)}</b>{team}\n  {status}")
            if invited:
                buttons.append([(f"Подтвердить: {item.contest.title[:28]}", f"a:ok:{item.id}"),
                                ("Отказаться", f"a:no:{item.id}")])
        return [Reply("\n".join(lines), buttons + self._open_row("/cabinet"))]

    async def _answer_invite(self, user: UserModel, rest: str) -> list[Reply]:
        """Подтверждает или отклоняет приглашение участника заявки."""
        action, _, raw_id = rest.partition(":")
        if action == "ok":
            item = await self._applications.confirm(user.id, int(raw_id), None)
            return [Reply(f"Участие подтверждено: <b>{escape(item.contest.title)}</b>.", edit=True, toast="Подтверждено")]
        item = await self._applications.decline(user.id, int(raw_id), None)
        return [Reply(f"Вы отказались от участия: <b>{escape(item.contest.title)}</b>.", edit=True, toast="Отказ отправлен")]

    async def _contests_view(self, chat_id: int) -> list[Reply]:
        """Показывает ближайшие соревнования со ссылками на сайт."""
        items, _ = await self._contests.list(ContestQuery(statuses=UPCOMING, period="upcoming", sort="date_asc"), 5, 0)
        if not items:
            return [Reply("Ближайших соревнований пока нет.", self._open_row("/calendar"))]
        lines, buttons = ["<b>Ближайшие соревнования</b>"], []
        for item in items:
            dates = item.starts_on.strftime("%d.%m.%Y")
            if item.ends_on != item.starts_on:
                dates += f" – {item.ends_on.strftime('%d.%m.%Y')}"
            lines.append(f"\n• <b>{escape(item.title)}</b>\n  {dates} · {CONTEST_STATUS_TITLES[item.status]}")
            url = self._url(f"/competitions/{item.id}")
            if url:
                buttons.append([(item.title[:40], url)])
        return [Reply("\n".join(lines), buttons or self._open_row("/calendar"))]

    async def _settings_view(self, chat_id: int, edit: bool = False) -> list[Reply]:
        """Показывает настройки уведомлений в Telegram с кнопками включения/выключения групп."""
        user = await self._require(chat_id)
        rows = await self._notifications.preferences(user.id)
        lines = ["<b>Что присылать в Telegram</b>", "Нажмите на группу, чтобы включить или выключить.", ""]
        buttons: Buttons = []
        for group, label, _description, _email, telegram, locked in rows:
            mark = "включено" if telegram else "выключено"
            lines.append(f"• {escape(label)}: {'всегда' if locked else mark}")
            if not locked:
                buttons.append([(f"{'✓' if telegram else '✕'} {label}", f"s:{group}")])
        return [Reply("\n".join(lines), buttons + self._open_row("/cabinet"), edit=edit)]

    async def _toggle(self, chat_id: int, user: UserModel, group: NotificationGroup) -> list[Reply]:
        """Переключает получение уведомлений группы в Telegram и обновляет вид настроек."""
        rows = await self._notifications.preferences(user.id)
        current = next(row for row in rows if row[0] == group)
        await self._notifications.set_preferences(user.id, [(group, Channel.TELEGRAM, not current[4])])
        replies = await self._settings_view(chat_id, edit=True)
        replies[0].toast = f"{current[1]}: {'выключено' if current[4] else 'включено'}"
        return replies

    async def _admin_view(self, chat_id: int) -> list[Reply]:
        """Показывает панель федерации с правами и доступными действиями по уровню администратора."""
        user = await self._require(chat_id)
        level = await self._admins.level(user.id)
        if level is None:
            return [Reply("Панель доступна только администраторам бота.")]
        rights = BotAdmins.RIGHTS[level]
        lines = [f"<b>Панель федерации</b>\nУровень: {BotAdmins.LEVEL_LABELS[level]}", ""]
        lines += [f"• {BotAdmins.RIGHT_LABELS[right]}" for right in rights]
        actions = {"queue": "Очередь модерации", "stats": "Статистика", "broadcast": "Рассылка",
                   "admins": "Администраторы"}
        buttons: Buttons = [[(label, f"adm:{right}")] for right, label in actions.items() if right in rights]
        return [Reply("\n".join(lines), buttons)]

    async def _admin_action(self, chat_id: int, user: UserModel, right: str) -> list[Reply]:
        """Выполняет выбранное действие панели федерации: очередь, статистика, рассылка, админы."""
        if not await self._admins.can(user.id, right):
            return [Reply("Недостаточно прав.", toast="Недостаточно прав")]
        if right == "queue":
            return await self._queue()
        if right == "stats":
            counts = await self._stats.counts()
            return [Reply("\n".join([
                "<b>Статистика платформы</b>", "",
                f"Активных аккаунтов: <b>{counts['users']}</b>",
                f"Подтвердили почту: <b>{counts['verified']}</b>",
                f"Привязали Telegram: <b>{counts['telegram']}</b>",
                f"Заявок на роли ждут решения: <b>{counts['roles']}</b>",
                f"Заявок на участие на рассмотрении: <b>{counts['applications']}</b>",
                f"Соревнований на верификации: <b>{counts['verification']}</b>",
            ]))]
        if right == "broadcast":
            await self._state.set(chat_id, {"action": "broadcast"})
            return [Reply("Пришлите текст рассылки одним сообщением. Его получат все, кто привязал Telegram.\n"
                          "/cancel — отменить.")]
        admins = await self._admins.list()
        lines = ["<b>Администраторы бота</b>", ""]
        lines += [f"• {_name(item.user)} — {BotAdmins.LEVEL_LABELS[item.level]}" for item in admins]
        lines.append("\nНазначить или снять: «Настройки» в кабинете федерации.")
        return [Reply("\n".join(lines), self._open_row("/cabinet/federation/settings"))]

    async def _queue(self) -> list[Reply]:
        """Показывает очередь заявок на роли в ожидании с кнопками подтверждения и отказа."""
        requests, total = await self._roles.list_requests(frozenset({RoleStatus.PENDING}), None, None, 5, 0)
        counts = await self._stats.counts()
        replies = [Reply(f"<b>Очередь модерации</b>\nЗаявок на роли: <b>{total}</b>"
                         f"\nСоревнований на верификации: <b>{counts['verification']}</b>",
                         self._open_row("/cabinet/federation/competitions?tab=queue"))]
        for item in requests:
            replies.append(Reply(
                f"Заявка на роль «{escape(Notifications.ROLE_LABELS[item.role])}»\n<b>{_name(item.user)}</b>, "
                f"{escape(item.user.email)}",
                [[("Подтвердить", f"r:ok:{item.id}"), ("Отклонить", f"r:no:{item.id}")]]))
        return replies

    async def _decide_role(self, chat_id: int, user: UserModel, rest: str) -> list[Reply]:
        """Подтверждает заявку на роль или запрашивает причину отказа."""
        if not await self._admins.can(user.id, "decide"):
            return [Reply("Недостаточно прав.", toast="Недостаточно прав")]
        action, _, raw_id = rest.partition(":")
        if action == "ok":
            item = await self._roles.approve(user.id, UUID(raw_id), None)
            return [Reply(f"Подтверждено: {_name(item.user)}, роль «{escape(Notifications.ROLE_LABELS[item.role])}».",
                          edit=True, toast="Роль подтверждена")]
        await self._state.set(chat_id, {"action": "reject_role", "id": raw_id})
        return [Reply("Напишите причину отказа одним сообщением. Её увидит пользователь.\n/cancel — отменить.",
                      toast="Нужна причина")]

    async def _continue(self, chat_id: int, user: UserModel, state: dict[str, Any], text: str) -> list[Reply]:
        """Обрабатывает свободный текст в рамках сохранённого состояния: отказ в роли или текст рассылки."""
        try:
            if state.get("action") == "reject_role" and await self._admins.can(user.id, "decide"):
                if len(text) < 3:
                    return [Reply("Причина слишком короткая. Напишите подробнее или /cancel.")]
                await self._state.clear(chat_id)
                item = await self._roles.reject(user.id, UUID(state["id"]), text[:500], None)
                return [Reply(f"Отклонено: {_name(item.user)}. Причина отправлена пользователю.")]
            if state.get("action") == "broadcast" and await self._admins.can(user.id, "broadcast"):
                await self._state.set(chat_id, {"action": "broadcast_ready", "text": text[:3500]})
                chats = await self._stats.chats()
                return [Reply(f"<b>Предпросмотр рассылки</b>\n\n{escape(text[:3500])}\n\nПолучателей: {len(chats)}",
                              [[("Отправить", "b:send"), ("Отмена", "b:cancel")]])]
        except AppError as error:
            await self._uow.rollback()
            return [Reply(_error(error))]
        await self._state.clear(chat_id)
        return await self._menu(chat_id)

    async def _broadcast_decision(self, chat_id: int, user: UserModel, decision: str) -> list[Reply]:
        """Ставит подготовленную рассылку в очередь исходящих или отменяет её."""
        state = await self._state.get(chat_id)
        await self._state.clear(chat_id)
        if decision != "send" or not state or state.get("action") != "broadcast_ready":
            return [Reply("Рассылка отменена.", edit=True, toast="Отменено")]
        if not await self._admins.can(user.id, "broadcast"):
            return [Reply("Недостаточно прав.", toast="Недостаточно прав")]
        chats = await self._stats.chats()
        for chat, recipient_id in chats:
            await self._outbox.add(OutboxModel(channel=Channel.TELEGRAM, user_id=recipient_id, type="system.broadcast",
                                               recipient=str(chat), title="Сообщение федерации", text=state["text"],
                                               status=EmailStatus.PENDING))
        await self._uow.commit()
        return [Reply(f"Рассылка поставлена в очередь: {len(chats)} получателей.", edit=True, toast="Отправлено")]

    async def _require(self, chat_id: int) -> UserModel:
        """Возвращает привязанного к чату пользователя или бросает ошибку, если аккаунт не привязан."""
        user = await self._telegram.user(chat_id)
        if user is None:
            raise AppError("Аккаунт не привязан")
        return user

    def _url(self, path: str) -> str | None:
        """Строит абсолютную ссылку на фронтенд; None, если фронтенд на локальном хосте."""
        base = self._settings.frontend_url.rstrip("/")
        return None if (urlsplit(base).hostname or "") in LOCAL_HOSTS else base + path

    def _open_row(self, path: str) -> Buttons:
        """Строит ряд с кнопкой «Открыть на сайте», если ссылка доступна."""
        url = self._url(path)
        return [[("Открыть на сайте", url)]] if url else []
