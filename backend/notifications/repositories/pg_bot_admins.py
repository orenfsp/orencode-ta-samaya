from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.notifications.bot_admin import BotAdminModel
from infrastructure.enums import BotAdminLevel


class BotAdminRepository:
    """Доступ к администраторам Telegram-бота в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def level(self, user_id: UUID) -> BotAdminLevel | None:
        """Возвращает уровень администратора бота у пользователя или None."""
        return await self._db.scalar(select(BotAdminModel.level).where(BotAdminModel.user_id == user_id))

    async def all(self) -> Sequence[BotAdminModel]:
        """Возвращает всех администраторов бота по дате назначения."""
        return (await self._db.scalars(select(BotAdminModel).order_by(BotAdminModel.created_at))).all()

    async def owners(self) -> int:
        """Возвращает количество владельцев бота."""
        return await self._db.scalar(select(func.count()).select_from(BotAdminModel)
                                     .where(BotAdminModel.level == BotAdminLevel.OWNER)) or 0

    async def add(self, user_id: UUID, level: BotAdminLevel, granted_by: UUID | None) -> None:
        """Назначает пользователя администратором бота указанного уровня."""
        self._db.add(BotAdminModel(user_id=user_id, level=level, granted_by=granted_by))
        await self._db.flush()

    async def set_level(self, user_id: UUID, level: BotAdminLevel) -> None:
        """Меняет уровень администратора бота."""
        await self._db.execute(update(BotAdminModel).where(BotAdminModel.user_id == user_id).values(level=level))

    async def remove(self, user_id: UUID) -> None:
        """Снимает пользователя с администраторов бота."""
        await self._db.execute(delete(BotAdminModel).where(BotAdminModel.user_id == user_id))
