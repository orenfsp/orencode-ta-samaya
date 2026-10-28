from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from events.dependencies import CalendarDep
from events.features.admin.schemas import EventIn, EventOut, EventPage, EventPatch
from infrastructure.enums import Role

router = APIRouter(tags=["Календарь: федерация"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


@router.get("/admin/calendar/events")
async def admin_events(
    user: Federation, calendar: CalendarDep,
    q: Annotated[str, Query(max_length=300)] = "",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventPage:
    """Возвращает страницу событий календаря для админки с поиском."""
    items, total = await calendar.admin_list(q.strip(), limit, offset)
    return EventPage(items=[EventOut.model_validate(item) for item in items], total=total)


@router.get("/admin/calendar/events/{event_id}")
async def admin_detail(event_id: Annotated[UUID, Path()], user: Federation, calendar: CalendarDep) -> EventOut:
    """Возвращает событие календаря по id в любом статусе."""
    return EventOut.model_validate(await calendar.admin_get(event_id))


@router.post("/admin/calendar/events", status_code=201)
async def create_event(body: Annotated[EventIn, Body()], user: Federation, calendar: CalendarDep, ip: ClientIp) -> EventOut:
    """Создаёт новое событие календаря в статусе «draft»."""
    return EventOut.model_validate(await calendar.create(body.model_dump(), user.id, ip))


@router.patch("/admin/calendar/events/{event_id}")
async def update_event(event_id: Annotated[UUID, Path()], body: Annotated[EventPatch, Body()], user: Federation,
                       calendar: CalendarDep, ip: ClientIp) -> EventOut:
    """Обновляет переданные поля события календаря."""
    return EventOut.model_validate(await calendar.update(event_id, body.model_dump(exclude_unset=True), user.id, ip))


@router.post("/admin/calendar/events/{event_id}/{action}")
async def change_status(event_id: Annotated[UUID, Path()], action: Annotated[Literal["publish", "unpublish", "archive"], Path()],
                        user: Federation, calendar: CalendarDep, ip: ClientIp) -> EventOut:
    """Меняет статус события: публикация, снятие с публикации или архивация."""
    return EventOut.model_validate(await calendar.transition(event_id, action, user.id, ip))
