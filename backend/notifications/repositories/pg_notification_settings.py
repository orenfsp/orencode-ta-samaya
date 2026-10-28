from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.enums import Channel
from infrastructure.notifications.notification_setting import NotificationSettingModel


class NotificationSettingRepository:
    """Доступ к отключённым группам и каналам уведомлений пользователя в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def disabled(self, user_id: UUID) -> set[tuple[str, Channel]]:
        """Возвращает набор отключённых пар «группа, канал» для пользователя."""
        rows = await self._db.execute(select(NotificationSettingModel.group, NotificationSettingModel.channel).where(
            NotificationSettingModel.user_id == user_id, NotificationSettingModel.enabled.is_(False)))
        return {(group, channel) for group, channel in rows}

    async def replace(self, user_id: UUID, disabled: set[tuple[str, Channel]]) -> None:
        """Заменяет набор отключённых пар «группа, канал» пользователя на новый."""
        await self._db.execute(delete(NotificationSettingModel).where(NotificationSettingModel.user_id == user_id))
        self._db.add_all(NotificationSettingModel(user_id=user_id, group=group, channel=channel, enabled=False)
                         for group, channel in disabled)
        await self._db.flush()
