from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import Role
from people.dependencies import WallDep
from people.features.admin.schemas import ModeratedOut, ModerationIn

router = APIRouter(prefix="/admin", tags=["Лента: федерация"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


@router.patch("/wall-posts/{post_id}", summary="Скрыть или вернуть пост")
async def moderate(
    post_id: Annotated[UUID, Path()],
    body: Annotated[ModerationIn, Body()],
    user: Federation,
    ip: ClientIp,
    wall: WallDep,
) -> ModeratedOut:
    """Скрывает или возвращает пост стены решением федерации."""
    post = await wall.moderate(user.id, post_id, body.hidden_by_federation, ip)
    return ModeratedOut(id=post.id, hidden_by_federation=post.hidden_by_federation)
