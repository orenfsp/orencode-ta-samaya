from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.calendar_event import ORENBURG, CalendarEventModel


class CalendarRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, event_id: UUID, lock: bool = False) -> CalendarEventModel | None:
        statement = select(CalendarEventModel).where(CalendarEventModel.id == event_id)
        if lock:
            statement = statement.with_for_update()
        return await self._db.scalar(statement.execution_options(populate_existing=True))

    async def published(self, start: date, end: date, q: str) -> list[CalendarEventModel]:
        conditions = [
            CalendarEventModel.status == "published",
            CalendarEventModel.starts_at < datetime.combine(end + timedelta(days=1), time(), ORENBURG),
            CalendarEventModel.ends_at >= datetime.combine(start, time(), ORENBURG),
        ]
        if q:
            conditions.append(CalendarEventModel.title.icontains(q, autoescape=True))
        rows = await self._db.scalars(select(CalendarEventModel).where(*conditions))
        return list(rows)

    async def list(self, q: str, limit: int, offset: int) -> tuple[list[CalendarEventModel], int]:
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
        event = CalendarEventModel(**values)
        self._db.add(event)
        await self._db.flush()
        await self._db.refresh(event)
        return event

    async def flush(self) -> None:
        await self._db.flush()
