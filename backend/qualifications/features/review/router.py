from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import QualificationKind, QualificationStatus, Role
from qualifications.dependencies import QualificationsDep
from qualifications.features.schemas import ApproveIn, PreviewOut, QualificationOut, RejectIn

router = APIRouter(prefix="/admin/qualifications", tags=["Разряды и категории: федерация"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
QualificationId = Annotated[UUID, Path()]


@router.get("", summary="Очередь и история заявок")
async def queue(
    _: Federation,
    qualifications: QualificationsDep,
    kind: Annotated[QualificationKind | None, Query()] = None,
    status: Annotated[QualificationStatus | None, Query()] = QualificationStatus.PENDING,
) -> list[QualificationOut]:
    """Отдаёт заявки на рассмотрение или историю, по виду и статусу."""
    return [QualificationOut.of(item) for item in await qualifications.queue(kind, status)]


@router.get("/{qualification_id}/preview", summary="Срок действия, если одобрить сегодня")
async def preview(qualification_id: QualificationId, _: Federation, qualifications: QualificationsDep) -> PreviewOut:
    """Показывает срок действия разряда или категории, если одобрить заявку сегодня."""
    return PreviewOut(valid_until=await qualifications.preview(qualification_id))


@router.post("/{qualification_id}/approve", summary="Присвоить")
async def approve(
    qualification_id: QualificationId,
    body: Annotated[ApproveIn, Body()],
    user: Federation,
    ip: ClientIp,
    qualifications: QualificationsDep,
) -> QualificationOut:
    """Одобряет заявку на разряд или категорию с номером и датой приказа."""
    return QualificationOut.of(await qualifications.approve(user.id, qualification_id, body.order_number, body.order_date, ip))


@router.post("/{qualification_id}/reject", summary="Отказать с причиной")
async def reject(
    qualification_id: QualificationId,
    body: Annotated[RejectIn, Body()],
    user: Federation,
    ip: ClientIp,
    qualifications: QualificationsDep,
) -> QualificationOut:
    """Отклоняет заявку на разряд или категорию с причиной."""
    return QualificationOut.of(await qualifications.reject(user.id, qualification_id, body.reason, ip))
