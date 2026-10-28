from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.enums import EmailStatus
from infrastructure.notifications.notification import NotificationModel


class NotificationRepository:
    """Доступ к уведомлениям пользователей в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def add(self, item: NotificationModel) -> NotificationModel:
        """Добавляет новое уведомление."""
        self._db.add(item)
        await self._db.flush()
        return item

    async def list(self, user_id: UUID, unread_only: bool, limit: int, offset: int) -> tuple[list[NotificationModel], int]:
        """Возвращает страницу уведомлений пользователя и их общее количество."""
        filters = [NotificationModel.user_id == user_id]
        if unread_only:
            filters.append(NotificationModel.is_read.is_(False))
        total = await self._db.scalar(select(func.count()).select_from(NotificationModel).where(*filters))
        items = await self._db.scalars(select(NotificationModel).where(*filters)
            .order_by(NotificationModel.created_at.desc(), NotificationModel.id.desc()).limit(limit).offset(offset))
        return list(items), total or 0

    async def unread_count(self, user_id: UUID) -> int:
        """Возвращает количество непрочитанных уведомлений пользователя."""
        return await self._db.scalar(select(func.count()).select_from(NotificationModel).where(
            NotificationModel.user_id == user_id, NotificationModel.is_read.is_(False))) or 0

    async def read(self, user_id: UUID, notification_id: UUID) -> bool:
        """Отмечает уведомление пользователя прочитанным; False, если его нет."""
        result = await self._db.scalar(update(NotificationModel).where(
            NotificationModel.id == notification_id, NotificationModel.user_id == user_id)
            .values(is_read=True).returning(NotificationModel.id))
        return result is not None

    async def set_email_status(self, notification_id: UUID, status: EmailStatus, sent_at: datetime | None) -> None:
        """Обновляет статус и время отправки email для уведомления."""
        await self._db.execute(update(NotificationModel).where(NotificationModel.id == notification_id)
                               .values(email_status=status, email_sent_at=sent_at))

    async def read_all(self, user_id: UUID) -> None:
        """Отмечает все непрочитанные уведомления пользователя прочитанными."""
        await self._db.execute(update(NotificationModel).where(NotificationModel.user_id == user_id,
            NotificationModel.is_read.is_(False)).values(is_read=True))
