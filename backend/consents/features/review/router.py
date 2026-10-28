from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query

from auth.dependencies import CurrentUser, require_role
from consents.dependencies import ConsentsDep
from consents.features.review.schemas import ConsentPage, ConsentRowOut, CountOut, FileOut, PersonOut, RejectIn
from core.request import ClientIp
from infrastructure.enums import CONSENT_STATUS_TITLES, ConsentStatus, Role
from infrastructure.account.guardian_consent import GuardianConsentModel
from infrastructure.account.user import UserModel

router = APIRouter(prefix="/admin/guardian-consents", tags=["Согласия представителей: федерация"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
ConsentId = Annotated[UUID, Path()]


def _row(item: GuardianConsentModel, user: UserModel) -> ConsentRowOut:
    """Собирает строку таблицы согласий с данными пользователя и файлом."""
    return ConsentRowOut(
        id=item.id,
        person=PersonOut(
            id=user.id,
            full_name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part),
            email=user.email,
            birth_date=user.birth_date,
        ),
        guardian_name=item.guardian_name,
        guardian_phone=item.guardian_phone,
        file=FileOut(id=item.file.id, original_name=item.file.original_name, url=f"/api/v1/files/{item.file.id}"),
        status=item.status,
        status_title=CONSENT_STATUS_TITLES[item.status],
        reject_reason=item.reject_reason,
        submitted_at=item.submitted_at,
        decided_at=item.decided_at,
    )


@router.get("", summary="Согласия: сначала на проверке")
async def queue(
    _: Federation,
    consents: ConsentsDep,
    status: Annotated[ConsentStatus | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ConsentPage:
    """Страница согласий на модерации: сначала ожидающие решения."""
    rows, total = await consents.queue(status, search, limit, offset)
    return ConsentPage(items=[_row(item, user) for item, user in rows], total=total)


@router.get("/count", summary="Сколько согласий ждёт решения")
async def count(_: Federation, consents: ConsentsDep) -> CountOut:
    """Количество согласий, ждущих решения."""
    return CountOut(pending=await consents.pending_count())


@router.post("/{consent_id}/approve", summary="Одобрить")
async def approve(consent_id: ConsentId, user: Federation, ip: ClientIp, consents: ConsentsDep) -> ConsentRowOut:
    """Одобряет согласие."""
    item = await consents.approve(user.id, consent_id, ip)
    owner = await consents.owner(item.user_id)
    assert owner is not None
    return _row(item, owner)


@router.post("/{consent_id}/reject", summary="Отклонить с причиной")
async def reject(
    consent_id: ConsentId, body: Annotated[RejectIn, Body()], user: Federation, ip: ClientIp, consents: ConsentsDep
) -> ConsentRowOut:
    """Отклоняет согласие с указанием причины."""
    item = await consents.reject(user.id, consent_id, body.reason, ip)
    owner = await consents.owner(item.user_id)
    assert owner is not None
    return _row(item, owner)
