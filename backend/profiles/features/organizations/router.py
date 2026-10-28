from typing import Annotated

from fastapi import APIRouter, Body, Depends, Path, Query, status

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import Role
from profiles.dependencies import OrganizationsDep
from profiles.features.schemas import OrganizationIn, OrganizationOut, OrganizationPage

router = APIRouter(tags=["Организации"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
OrganizationId = Annotated[int, Path()]


@router.get("/organizations", summary="Поиск организаций")
async def search(
    organizations: OrganizationsDep,
    q: Annotated[str | None, Query(max_length=100)] = None,
    municipality_id: Annotated[int | None, Query()] = None,
    organization_type_id: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OrganizationPage:
    """Публичный поиск действующих организаций."""
    items, total, counts = await organizations.search(q, municipality_id, organization_type_id, True, limit, offset)
    return OrganizationPage(items=[OrganizationOut.of(item, counts.get(item.id, 0)) for item in items], total=total)


@router.get("/admin/organizations", summary="Организации: все, с архивом")
async def admin_search(
    _: Federation,
    organizations: OrganizationsDep,
    q: Annotated[str | None, Query(max_length=100)] = None,
    municipality_id: Annotated[int | None, Query()] = None,
    organization_type_id: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OrganizationPage:
    """Поиск организаций для федерации, включая неактивные."""
    items, total, counts = await organizations.search(q, municipality_id, organization_type_id, False, limit, offset)
    return OrganizationPage(
        items=[OrganizationOut.of(item, counts.get(item.id, 0), full=True) for item in items], total=total
    )


@router.post("/admin/organizations", status_code=status.HTTP_201_CREATED, summary="Добавить организацию")
async def create(
    body: Annotated[OrganizationIn, Body()], user: Federation, ip: ClientIp, organizations: OrganizationsDep
) -> OrganizationOut:
    """Создаёт организацию."""
    item = await organizations.create(user.id, body.model_dump(exclude_unset=True), ip)
    return OrganizationOut.of(item, full=True)


@router.patch("/admin/organizations/{organization_id}", summary="Изменить организацию")
async def update(
    organization_id: OrganizationId,
    body: Annotated[OrganizationIn, Body()],
    user: Federation,
    ip: ClientIp,
    organizations: OrganizationsDep,
) -> OrganizationOut:
    """Правит организацию."""
    item = await organizations.update(user.id, organization_id, body.model_dump(exclude_unset=True), ip)
    return OrganizationOut.of(item, full=True)
