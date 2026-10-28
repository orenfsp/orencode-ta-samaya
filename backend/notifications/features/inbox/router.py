from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query, Response

from auth.dependencies import CurrentUserDep
from notifications.dependencies import NotificationsDep
from notifications.features.inbox.schemas import NotificationOut, NotificationPage, UnreadCount

router = APIRouter(prefix="/notifications", tags=["Уведомления"])


@router.get("")
async def inbox(user: CurrentUserDep, notifications: NotificationsDep,
                unread_only: Annotated[bool, Query()] = False,
                limit: Annotated[int, Query(ge=1, le=100)] = 20,
                offset: Annotated[int, Query(ge=0, le=2147483647)] = 0) -> NotificationPage:
    """Возвращает страницу уведомлений пользователя."""
    items, total = await notifications.list(user.id, unread_only, limit, offset)
    return NotificationPage(items=[NotificationOut.model_validate(item) for item in items], total=total)


@router.get("/unread-count")
async def unread_count(user: CurrentUserDep, notifications: NotificationsDep) -> UnreadCount:
    """Возвращает количество непрочитанных уведомлений."""
    return UnreadCount(count=await notifications.unread_count(user.id))


@router.post("/read-all", status_code=204)
async def read_all(user: CurrentUserDep, notifications: NotificationsDep) -> Response:
    """Отмечает все уведомления пользователя прочитанными."""
    await notifications.read_all(user.id)
    return Response(status_code=204)


@router.post("/{id}/read", status_code=204)
async def read_one(id: Annotated[UUID, Path()], user: CurrentUserDep, notifications: NotificationsDep) -> Response:
    """Отмечает одно уведомление прочитанным."""
    await notifications.read(user.id, id)
    return Response(status_code=204)
