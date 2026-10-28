import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from core.config import Settings
from infrastructure.enums import Channel, EmailStatus
from infrastructure.notifications.outbox import OutboxModel
from notifications.domain.letter import Letter
from notifications.repositories.pg_notifications import NotificationRepository
from notifications.repositories.pg_outbox import OutboxRepository
from notifications.repositories.pg_telegram_links import TelegramLinkRepository
from notifications.clients.smtp import SmtpClient
from notifications.clients.telegram import TelegramBlocked, TelegramClient


class OutboxWorker:
    """Фоновая отправка писем и Telegram-сообщений из очереди outbox с повторами."""

    DELAYS = (30, 120, 300, 900)
    MAX_ATTEMPTS = 5
    BATCH = 20
    INTERVAL_SECONDS = 2
    LEASE_SECONDS = 300

    def __init__(self, sessions: async_sessionmaker[AsyncSession], smtp: SmtpClient,
                 telegram: TelegramClient | None, settings: Settings) -> None:
        """Сохраняет зависимости."""
        self._sessions, self._smtp, self._telegram, self._letter = sessions, smtp, telegram, Letter(settings)
        self._logger = logging.getLogger("fsp.outbox")

    async def process_one(self) -> bool:
        """Забирает одно сообщение из очереди и доставляет его; False, если очередь пуста."""
        async with self._sessions() as db:
            item = await self._claim(OutboxRepository(db))
            await db.commit()
        if item is None or item.lease_token is None:
            return False
        status, error, delay = EmailStatus.SENT, None, 0
        if item.expires_at and item.expires_at <= datetime.now(UTC):
            status, error = EmailStatus.FAILED, "expired"
        elif item.attempts > self.MAX_ATTEMPTS:
            status, error = EmailStatus.FAILED, "delivery_interrupted"
        else:
            try:
                await self._deliver(item)
            except TelegramBlocked:
                status, error = EmailStatus.FAILED, "telegram_blocked"
                async with self._sessions() as db:
                    await TelegramLinkRepository(db).remove_chat(int(item.recipient))
                    await db.commit()
            except Exception as exc:
                error = type(exc).__name__[:100]
                retry = item.attempts < self.MAX_ATTEMPTS
                status = EmailStatus.PENDING if retry else EmailStatus.FAILED
                delay = self.DELAYS[item.attempts - 1] if retry else 0
                self._logger.warning("Outbox attempt failed: job=%s channel=%s kind=%s", item.id, item.channel, error)
        async with self._sessions() as db:
            await self._finish(db, item.id, item.lease_token, status, error, delay)
            await db.commit()
        return True

    async def _claim(self, outbox: OutboxRepository) -> OutboxModel | None:
        """Берёт в работу следующее готовое сообщение и выставляет ему аренду."""
        now = datetime.now(UTC)
        item = await outbox.next_due(now)
        if item is not None:
            item.status = EmailStatus.SENDING
            item.lease_token = uuid.uuid4()
            item.leased_until = now + timedelta(seconds=self.LEASE_SECONDS)
            item.attempts += 1
            await outbox.flush()
        return item

    async def _finish(
        self, db: AsyncSession, item_id: UUID, lease: UUID, status: EmailStatus, error: str | None, delay: int
    ) -> None:
        """Завершает попытку доставки: обновляет статус, снимает аренду и чистит текст у готовых сообщений."""
        now = datetime.now(UTC)
        values: dict[str, Any] = dict(status=status, last_error=error, lease_token=None, leased_until=None,
                                      next_attempt_at=now + timedelta(seconds=delay))
        if status == EmailStatus.SENT:
            values["sent_at"] = now
        if status in (EmailStatus.SENT, EmailStatus.FAILED):
            values.update(text="", link=None, code=None)
        finished = await OutboxRepository(db).finish(item_id, lease, values)
        if finished is not None and finished[0] is not None and finished[1] == Channel.EMAIL:
            await NotificationRepository(db).set_email_status(
                finished[0], status, now if status == EmailStatus.SENT else None
            )

    async def _deliver(self, item: OutboxModel) -> None:
        """Отправляет сообщение через Telegram или почту в зависимости от канала."""
        if item.channel == Channel.TELEGRAM:
            if self._telegram is None:
                raise RuntimeError("telegram_disabled")
            text, buttons = self._letter.telegram(item)
            await self._telegram.send(int(item.recipient), text, buttons)
        else:
            await self._smtp.send(self._letter.build(item))

    async def run(self) -> None:
        """Бесконечно обрабатывает очередь пачками с паузой между циклами."""
        while True:
            try:
                for _ in range(self.BATCH):
                    if not await self.process_one():
                        break
            except Exception as error:
                self._logger.warning("Outbox unavailable: kind=%s", type(error).__name__)
            await asyncio.sleep(self.INTERVAL_SECONDS)
