from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.config import settings
from core.database import DbSession, UnitOfWork, session_factory
from deadlines.domain.deadlines import Deadlines, DeadlineWatcherCalendar
from deadlines.repositories.pg_deadlines import DeadlineRepository
from notifications.dependencies import get_notifications
from notifications.domain.notifications import Notifications


def get_deadlines(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Deadlines:
    """Собирает сервис сроков для запроса."""
    return Deadlines(UnitOfWork(db), DeadlineRepository(db), audit)


def _notifications(db: AsyncSession) -> Notifications:
    """Собирает уведомления на сессии фонового наблюдателя."""
    return get_notifications(db)


def calendar_watcher() -> DeadlineWatcherCalendar:
    """Создаёт фоновый наблюдатель сроков со своими сессиями БД."""
    return DeadlineWatcherCalendar(session_factory, _notifications, settings.deadline_interval_seconds)


DeadlinesDep = Annotated[Deadlines, Depends(get_deadlines)]
