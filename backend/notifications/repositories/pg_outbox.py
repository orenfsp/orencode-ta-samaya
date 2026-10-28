from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.enums import Channel, EmailStatus
from infrastructure.notifications.outbox import OutboxModel


class OutboxRepository:
    """Доступ к очереди исходящих сообщений (outbox) в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def add(self, item: OutboxModel) -> None:
        """Добавляет новое сообщение в очередь."""
        self._db.add(item)
        await self._db.flush()

    async def next_due(self, now: datetime) -> OutboxModel | None:
        """Блокирует и возвращает следующее готовое к отправке или просроченное сообщение."""
        return await self._db.scalar(select(OutboxModel).where(or_(
            and_(OutboxModel.status == EmailStatus.PENDING, OutboxModel.next_attempt_at <= now),
            and_(OutboxModel.status == EmailStatus.PENDING, OutboxModel.expires_at <= now),
            and_(OutboxModel.status == EmailStatus.SENDING, OutboxModel.leased_until <= now)))
            .order_by(OutboxModel.next_attempt_at, OutboxModel.id).limit(1).with_for_update(skip_locked=True))

    async def flush(self) -> None:
        """Сбрасывает текущие изменения сессии в БД без коммита."""
        await self._db.flush()

    async def finish(self, item_id: UUID, lease: UUID, values: dict[str, Any]) -> tuple[UUID | None, Channel] | None:
        """Завершает попытку доставки по актуальной аренде; возвращает id уведомления и канал."""
        row = (await self._db.execute(update(OutboxModel).where(OutboxModel.id == item_id,
            OutboxModel.status == EmailStatus.SENDING, OutboxModel.lease_token == lease)
            .values(**values).returning(OutboxModel.notification_id, OutboxModel.channel))).first()
        return (row[0], row[1]) if row else None
