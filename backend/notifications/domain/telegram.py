import secrets
from html import escape
from uuid import UUID

from auth.repositories.pg_users import UserRepository
from core.config import Settings
from core.database import UnitOfWork
from core.errors import InvalidStatus
from infrastructure.notifications.telegram_link import TelegramLinkModel
from infrastructure.account.user import UserModel
from notifications.repositories.pg_telegram_links import TelegramLinkRepository
from notifications.repositories.red_telegram_tokens import TelegramTokenRepository


class Telegram:
    """Привязка аккаунта к Telegram-чату и подготовка сообщений бота."""

    def __init__(self, links: TelegramLinkRepository, tokens: TelegramTokenRepository, users: UserRepository,
                 uow: UnitOfWork, settings: Settings) -> None:
        """Сохраняет зависимости."""
        self._links, self._tokens, self._users, self._uow, self._settings = links, tokens, users, uow, settings

    @property
    def available(self) -> bool:
        """Проверяет, настроен ли на сервере токен Telegram-бота."""
        return self._settings.telegram_bot_token is not None

    async def status(self, user_id: UUID) -> TelegramLinkModel | None:
        """Возвращает привязку пользователя к Telegram, если она есть."""
        return await self._links.by_user(user_id)

    async def link_url(self, user_id: UUID) -> str:
        """Выпускает одноразовый токен и возвращает ссылку для привязки через бота."""
        if not self.available:
            raise InvalidStatus("Telegram не подключён на этом сервере")
        token = secrets.token_urlsafe(16)
        await self._tokens.save(token, user_id, self._settings.telegram_link_ttl_seconds)
        return f"https://t.me/{self._settings.telegram_bot_username}?start={token}"

    async def unlink(self, user_id: UUID) -> None:
        """Отвязывает Telegram-чат от аккаунта пользователя."""
        await self._links.remove_user(user_id)
        await self._uow.commit()

    async def user(self, chat_id: int) -> UserModel | None:
        """Возвращает активного пользователя, привязанного к чату, или None."""
        link = await self._links.by_chat(chat_id)
        user = await self._users.get(link.user_id) if link else None
        return user if user and user.is_active else None

    async def link(self, chat_id: int, token: str, username: str | None) -> str:
        """Привязывает чат к аккаунту по одноразовому токену и возвращает ответное сообщение."""
        user_id = await self._tokens.pop(token)
        user = await self._users.get(user_id) if user_id else None
        if user is None or not user.is_active:
            return "Ссылка устарела. Откройте «Настройки» в кабинете и нажмите «Привязать Telegram» ещё раз."
        await self._links.save(user.id, chat_id, username)
        await self._uow.commit()
        return (f"Аккаунт ФСП привязан: <b>{escape(user.last_name)} {escape(user.first_name)}</b>.\n"
                "Уведомления из кабинета будут приходить сюда.")

    async def unlink_chat(self, chat_id: int) -> str:
        """Отвязывает аккаунт по команде из чата и возвращает ответное сообщение."""
        user_id = await self._links.remove_chat(chat_id)
        await self._uow.commit()
        return "Аккаунт отвязан. Уведомления сюда больше не придут." if user_id else "Аккаунт и так не привязан."

    def help(self, linked: bool) -> str:
        """Возвращает текст справки о боте, с подсказкой по привязке для непривязанных."""
        text = ("Бот Федерации спортивного программирования Оренбургской области.\n\n"
                "Присылает уведомления из личного кабинета: решения по ролям и заявкам, приглашения в команды, "
                "вход с нового устройства. Здесь же можно подтвердить участие и посмотреть свои заявки.")
        if not linked:
            text += ("\n\nЧтобы привязать аккаунт, войдите на сайт, откройте «Настройки» в кабинете "
                     "и нажмите «Привязать Telegram».")
        return text
