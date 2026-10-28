from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Response

from auth.dependencies import CurrentUser, require_role
from infrastructure.enums import BotAdminLevel, Role
from notifications.dependencies import BotAdminsDep, TelegramDep
from notifications.domain.bot_admins import BotAdmins
from notifications.features.bot_admins.schemas import BotAdminOut, BotAdminsOut, GrantIn, LevelIn, LevelOut

router = APIRouter(prefix="/admin/telegram/admins", tags=["Telegram: администраторы"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


@router.get("", summary="Администраторы бота и права уровней")
async def list_admins(user: Federation, admins: BotAdminsDep, telegram: TelegramDep) -> BotAdminsOut:
    """Возвращает администраторов бота, их уровни и права по уровням."""
    level = await admins.level(user.id)
    items = []
    for item in await admins.list():
        name = " ".join(part for part in (item.user.last_name, item.user.first_name, item.user.middle_name) if part)
        granter = f"{item.granter.last_name} {item.granter.first_name}" if item.granter else None
        items.append(BotAdminOut(user_id=item.user_id, full_name=name, email=item.user.email, level=item.level,
                                 linked=await telegram.status(item.user_id) is not None, granted_by=granter,
                                 created_at=item.created_at))
    return BotAdminsOut(
        my_level=level, can_manage=level == BotAdminLevel.OWNER, items=items,
        levels=[LevelOut(code=code, label=BotAdmins.LEVEL_LABELS[code],
                         rights=[BotAdmins.RIGHT_LABELS[right] for right in BotAdmins.RIGHTS[code]])
                for code in BotAdminLevel])


@router.post("", status_code=204, summary="Назначить администратора бота")
async def grant(body: Annotated[GrantIn, Body()], user: Federation, admins: BotAdminsDep) -> Response:
    """Назначает администратора бота по email."""
    await admins.grant(user.id, body.email, body.level)
    return Response(status_code=204)


@router.patch("/{user_id}", status_code=204, summary="Изменить уровень")
async def change(user_id: Annotated[UUID, Path()], body: Annotated[LevelIn, Body()], user: Federation,
                 admins: BotAdminsDep) -> Response:
    """Меняет уровень администратора бота."""
    await admins.change(user.id, user_id, body.level)
    return Response(status_code=204)


@router.delete("/{user_id}", status_code=204, summary="Снять администратора")
async def revoke(user_id: Annotated[UUID, Path()], user: Federation, admins: BotAdminsDep) -> Response:
    """Снимает администратора бота."""
    await admins.revoke(user.id, user_id)
    return Response(status_code=204)
