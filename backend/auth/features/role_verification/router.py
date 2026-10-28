from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query

from auth.dependencies import CurrentUser, RolesDep, require_role
from auth.features.role_verification.schemas import (
    RejectIn,
    RequestState,
    ResetIn,
    RoleRequestCounts,
    RoleRequestOut,
    RoleRequestPage,
)
from core.request import ClientIp
from infrastructure.enums import Role, RoleStatus

router = APIRouter(prefix="/admin/role-requests", tags=["role verification"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


@router.get("")
async def list_role_requests(
    user: Federation,
    roles: RolesDep,
    state: Annotated[RequestState | None, Query()] = None,
    status_filter: Annotated[RoleStatus | None, Query(alias="status")] = None,
    role: Annotated[Role | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RoleRequestPage:
    """Список заявок на роли с фильтрами по статусу, роли и поиску."""
    if status_filter is not None:
        statuses = frozenset({status_filter})
    elif state == RequestState.PENDING:
        statuses = frozenset({RoleStatus.PENDING})
    elif state == RequestState.DECIDED:
        statuses = frozenset({RoleStatus.VERIFIED, RoleStatus.REJECTED})
    else:
        statuses = frozenset(RoleStatus)
    items, total = await roles.list_requests(statuses, role, (search or "").strip() or None, limit, offset)
    return RoleRequestPage(items=[RoleRequestOut.model_validate(item) for item in items], total=total)


@router.get("/counts")
async def count_role_requests(user: Federation, roles: RolesDep) -> RoleRequestCounts:
    """Количество заявок в ожидании по каждой модерируемой роли."""
    return RoleRequestCounts(pending=await roles.count_pending())


@router.post("/{request_id}/approve")
async def approve_role_request(
    request_id: Annotated[UUID, Path()],
    user: Federation,
    ip: ClientIp,
    roles: RolesDep,
) -> RoleRequestOut:
    """Одобряет заявку на роль."""
    return RoleRequestOut.model_validate(await roles.approve(user.id, request_id, ip))


@router.post("/{request_id}/reject")
async def reject_role_request(
    request_id: Annotated[UUID, Path()],
    body: Annotated[RejectIn, Body()],
    user: Federation,
    ip: ClientIp,
    roles: RolesDep,
) -> RoleRequestOut:
    """Отклоняет заявку на роль с указанием причины."""
    return RoleRequestOut.model_validate(await roles.reject(user.id, request_id, body.reason, ip))


@router.post("/{request_id}/reset")
async def reset_role_request(
    request_id: Annotated[UUID, Path()],
    user: Federation,
    ip: ClientIp,
    roles: RolesDep,
    body: Annotated[ResetIn | None, Body()] = None,
) -> RoleRequestOut:
    """Возвращает решённую заявку на роль в состояние ожидания."""
    reason = body.reason if body else None
    return RoleRequestOut.model_validate(await roles.reset(user.id, request_id, reason, ip))
