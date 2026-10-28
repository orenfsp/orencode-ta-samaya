from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Path, Query

from auth.dependencies import OptionalUserDep
from events.dependencies import CalendarDep
from events.features.public.schemas import CalendarItemOut, CalendarPage, EventOut
from infrastructure.content.calendar_event import CalendarEventModel

router = APIRouter(tags=["Календарь"])


def today() -> date:
    """Возвращает текущую дату по оренбургскому времени."""
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


@router.get("/calendar/events")
async def list_events(
    calendar: CalendarDep,
    user: OptionalUserDep,
    discipline_id: Annotated[int | None, Query(ge=1)] = None,
    online: Annotated[bool | None, Query()] = None,
    mine: Annotated[bool, Query()] = False,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    kind: Annotated[Literal["event", "contest"] | None, Query()] = None,
    q: Annotated[str, Query(max_length=300)] = "",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CalendarPage:
    """Возвращает опубликованные события и/или соревнования за период с пагинацией."""
    start = date_from or today()
    items, total = await calendar.feed(start, date_to or start + timedelta(days=365), kind, q.strip(), limit, offset, discipline_id, online, mine, user.id if user else None)
    return CalendarPage(
        items=[
            CalendarItemOut.from_event(item) if isinstance(item, CalendarEventModel) else CalendarItemOut.from_contest(item)
            for item in items
        ],
        total=total,
    )


@router.get("/calendar/events/{event_id}")
async def event_detail(event_id: Annotated[UUID, Path()], calendar: CalendarDep) -> EventOut:
    """Возвращает опубликованное событие календаря по id."""
    return EventOut.model_validate(await calendar.get(event_id))
