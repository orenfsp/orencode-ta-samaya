from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from audit.features.log.schemas import AuditOut, AuditPage, CatalogEntry, CatalogOut
from auth.dependencies import CurrentUser, require_role
from infrastructure.enums import Role

router = APIRouter(prefix="/admin/audit", tags=["Журнал действий"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
AuditLog = Annotated[Audit, Depends(get_audit)]


@router.get("", summary="Записи журнала: order=desc — новые сверху, asc — старые")
async def audit_log(
    user: Federation,
    audit: AuditLog,
    q: Annotated[str | None, Query(max_length=100)] = None,
    user_id: Annotated[UUID | None, Query()] = None,
    action: Annotated[str | None, Query(max_length=50)] = None,
    object_type: Annotated[str | None, Query(max_length=50)] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=2147483647)] = 0,
    order: Annotated[Literal["desc", "asc"], Query()] = "desc",
) -> AuditPage:
    """Возвращает страницу записей журнала действий по фильтрам."""
    search = q.strip() if q else None
    rows, total = await audit.list(
        search, user_id, action, object_type, date_from, date_to, limit, offset, order == "asc"
    )
    items = [AuditOut.from_row(item, actor, audit.object_label(item.object_type)) for item, actor in rows]
    return AuditPage(items=items, total=total)


@router.get("/catalog", summary="Действия и объекты для фильтров")
async def audit_catalog(user: Federation, audit: AuditLog) -> CatalogOut:
    """Возвращает справочники действий и объектов для фильтров журнала."""
    actions, objects = audit.catalog()
    return CatalogOut(
        actions=[CatalogEntry(code=code, label=label) for code, label in actions],
        objects=[CatalogEntry(code=code, label=label) for code, label in objects],
    )
