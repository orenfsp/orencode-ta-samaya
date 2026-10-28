import asyncio
import logging
from collections.abc import Callable
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from core.config import Settings
from notifications.domain.notifications import Notifications
from qualifications.domain.qualifications import link_for, today
from qualifications.repositories.pg_deadline_notices import DeadlineNoticeRepository
from qualifications.repositories.pg_qualifications import QualificationRepository


class DeadlineWatcher:
    """Фоновый процесс, рассылающий напоминания об истекающих сроках разрядов и категорий."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession],
                 notifications: Callable[[AsyncSession], Notifications], settings: Settings) -> None:
        """Сохраняет фабрику сессий, фабрику Notifications и пороги напоминаний из настроек."""
        self._sessions, self._notifications = sessions, notifications
        self._thresholds = tuple(sorted(set(settings.deadline_thresholds_days) | {0}, reverse=True))
        self._interval = settings.deadline_interval_seconds
        self._logger = logging.getLogger("fsp.deadlines")

    async def tick(self) -> int:
        """Рассылает напоминания по истекающим разрядам и категориям; возвращает число отправленных."""
        sent = 0
        now = today()
        async with self._sessions() as db:
            notices, notifications = DeadlineNoticeRepository(db), self._notifications(db)
            for item in await QualificationRepository(db).expiring(now + timedelta(days=self._thresholds[0])):
                if item.valid_until is None:
                    continue
                left = (item.valid_until - now).days
                threshold = min(value for value in self._thresholds if left <= value)
                if not await notices.claim(item.id, threshold):
                    continue
                await notifications.qualification_expiring(
                    item.user_id, item.item_name, f"{item.valid_until:%d.%m.%Y}", max(left, 0) if threshold else 0,
                    link_for(item.kind),
                )
                sent += 1
            await db.commit()
        return sent

    async def run(self) -> None:
        """Бесконечно рассылает напоминания с заданным интервалом, не падая из-за ошибок."""
        while True:
            try:
                sent = await self.tick()
                if sent:
                    self._logger.info("Deadline notices sent: %s", sent)
            except asyncio.CancelledError:
                raise
            except Exception:
                self._logger.exception("Deadline watcher failed")
            await asyncio.sleep(self._interval)
