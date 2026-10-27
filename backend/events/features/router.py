from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, Path, Query

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from events.dependencies import CalendarDep
from events.features.schemas import CalendarItemOut, CalendarPage, EventIn, EventOut, EventPage, EventPatch
from infrastructure.calendar_event import CalendarEventModel
from infrastructure.enums import Role

router = APIRouter(tags=["calendar"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


def today() -> date:
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


@router.get("/calendar/events")
async def list_events(
    calendar: CalendarDep,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    kind: Annotated[Literal["event", "contest"] | None, Query()] = None,
    q: Annotated[str, Query(max_length=300)] = "",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CalendarPage:
    start = date_from or today()
    items, total = await calendar.feed(start, date_to or start + timedelta(days=365), kind, q.strip(), limit, offset)
    return CalendarPage(
        items=[
            CalendarItemOut.from_event(item) if isinstance(item, CalendarEventModel) else CalendarItemOut.from_contest(item)
            for item in items
        ],
        total=total,
    )


@router.get("/calendar/events/{event_id}")
async def event_detail(event_id: Annotated[UUID, Path()], calendar: CalendarDep) -> EventOut:
    return EventOut.model_validate(await calendar.get(event_id))


@router.get("/admin/calendar/events")
async def admin_events(
    user: Federation, calendar: CalendarDep,
    q: Annotated[str, Query(max_length=300)] = "",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventPage:
    items, total = await calendar.admin_list(q.strip(), limit, offset)
    return EventPage(items=[EventOut.model_validate(item) for item in items], total=total)


@router.get("/admin/calendar/events/{event_id}")
async def admin_detail(event_id: Annotated[UUID, Path()], user: Federation, calendar: CalendarDep) -> EventOut:
    return EventOut.model_validate(await calendar.admin_get(event_id))


@router.post("/admin/calendar/events", status_code=201)
async def create_event(body: Annotated[EventIn, Body()], user: Federation, calendar: CalendarDep, ip: ClientIp) -> EventOut:
    return EventOut.model_validate(await calendar.create(body.model_dump(), user.id, ip))


@router.patch("/admin/calendar/events/{event_id}")
async def update_event(event_id: Annotated[UUID, Path()], body: Annotated[EventPatch, Body()], user: Federation,
                       calendar: CalendarDep, ip: ClientIp) -> EventOut:
    return EventOut.model_validate(await calendar.update(event_id, body.model_dump(exclude_unset=True), user.id, ip))


@router.post("/admin/calendar/events/{event_id}/{action}")
async def change_status(event_id: Annotated[UUID, Path()], action: Annotated[Literal["publish", "unpublish", "archive"], Path()],
                        user: Federation, calendar: CalendarDep, ip: ClientIp) -> EventOut:
    return EventOut.model_validate(await calendar.transition(event_id, action, user.id, ip))
