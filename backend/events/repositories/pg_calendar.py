from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.content.calendar_event import CalendarEventModel


class CalendarRepository:
    """Доступ к событиям календаря в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, event_id: UUID, lock: bool = False) -> CalendarEventModel | None:
        """Возвращает событие по id, опционально с блокировкой строки для изменения."""
        statement = select(CalendarEventModel).where(CalendarEventModel.id == event_id)
        if lock:
            statement = statement.with_for_update()
        return await self._db.scalar(statement.execution_options(populate_existing=True))

    async def published(self, starts_before: datetime, ends_after: datetime, q: str) -> list[CalendarEventModel]:
        """Возвращает опубликованные события, пересекающиеся с периодом, с поиском по названию."""
        conditions = [
            CalendarEventModel.status == "published",
            CalendarEventModel.starts_at < starts_before,
            CalendarEventModel.ends_at >= ends_after,
        ]
        if q:
            conditions.append(CalendarEventModel.title.icontains(q, autoescape=True))
        rows = await self._db.scalars(select(CalendarEventModel).where(*conditions))
        return list(rows)

    async def list(self, q: str, limit: int, offset: int) -> tuple[list[CalendarEventModel], int]:
        """Возвращает страницу событий с поиском по названию и их общее количество."""
        conditions = [CalendarEventModel.title.icontains(q, autoescape=True)] if q else []
        total = await self._db.scalar(select(func.count()).select_from(CalendarEventModel).where(*conditions))
        rows = await self._db.scalars(
            select(CalendarEventModel)
            .where(*conditions)
            .order_by(CalendarEventModel.starts_at, CalendarEventModel.title, CalendarEventModel.id)
            .offset(offset)
            .limit(limit)
        )
        return list(rows), total or 0

    async def create(self, values: dict[str, Any]) -> CalendarEventModel:
        """Создаёт новое событие календаря с переданными полями."""
        event = CalendarEventModel(**values)
        self._db.add(event)
        await self._db.flush()
        await self._db.refresh(event)
        return event

    async def flush(self) -> None:
        """Сбрасывает текущие изменения сессии в БД без коммита."""
        await self._db.flush()
