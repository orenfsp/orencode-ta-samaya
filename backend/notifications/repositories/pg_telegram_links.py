from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.notifications.telegram_link import TelegramLinkModel


class TelegramLinkRepository:
    """Доступ к связям аккаунтов с Telegram-чатами в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def by_user(self, user_id: UUID) -> TelegramLinkModel | None:
        """Возвращает привязку Telegram по id пользователя."""
        return await self._db.scalar(select(TelegramLinkModel).where(TelegramLinkModel.user_id == user_id))

    async def by_chat(self, chat_id: int) -> TelegramLinkModel | None:
        """Возвращает привязку Telegram по id чата."""
        return await self._db.scalar(select(TelegramLinkModel).where(TelegramLinkModel.chat_id == chat_id))

    async def save(self, user_id: UUID, chat_id: int, username: str | None) -> None:
        """Привязывает чат к пользователю, удаляя прежние связи с этим пользователем или чатом."""
        await self._db.execute(delete(TelegramLinkModel).where(
            (TelegramLinkModel.user_id == user_id) | (TelegramLinkModel.chat_id == chat_id)))
        self._db.add(TelegramLinkModel(user_id=user_id, chat_id=chat_id, username=username))
        await self._db.flush()

    async def remove_user(self, user_id: UUID) -> bool:
        """Удаляет привязку Telegram пользователя; False, если её не было."""
        result = await self._db.execute(delete(TelegramLinkModel).where(TelegramLinkModel.user_id == user_id)
                                        .returning(TelegramLinkModel.user_id))
        return result.first() is not None

    async def remove_chat(self, chat_id: int) -> UUID | None:
        """Удаляет привязку чата и возвращает id отвязанного пользователя, если она была."""
        result = await self._db.execute(delete(TelegramLinkModel).where(TelegramLinkModel.chat_id == chat_id)
                                        .returning(TelegramLinkModel.user_id))
        row = result.first()
        return row[0] if row else None
