from typing import Annotated

from fastapi import APIRouter, Body

from auth.dependencies import CurrentUserDep
from consents.dependencies import ConsentsDep
from consents.domain.consents import is_minor
from consents.features.mine.schemas import ConsentIn, ConsentOut, FileOut, MyConsentOut
from core.errors import NotFound
from core.request import ClientIp
from infrastructure.enums import CONSENT_STATUS_TITLES
from infrastructure.account.guardian_consent import GuardianConsentModel

router = APIRouter(prefix="/me/guardian-consent", tags=["Согласие представителя"])


def consent_out(item: GuardianConsentModel) -> ConsentOut:
    """Собирает схему согласия с файлом и подписью статуса."""
    return ConsentOut(
        id=item.id,
        guardian_name=item.guardian_name,
        guardian_phone=item.guardian_phone,
        file=FileOut(id=item.file.id, original_name=item.file.original_name, url=f"/api/v1/files/{item.file.id}"),
        status=item.status,
        status_title=CONSENT_STATUS_TITLES[item.status],
        reject_reason=item.reject_reason,
        submitted_at=item.submitted_at,
        decided_at=item.decided_at,
    )


@router.get("", summary="Нужно ли согласие и его состояние")
async def mine(user: CurrentUserDep, consents: ConsentsDep) -> MyConsentOut:
    """Нужно ли согласие текущему пользователю и его текущее состояние."""
    owner = await consents.owner(user.id)
    if owner is None:
        raise NotFound()
    item = await consents.mine(user.id)
    return MyConsentOut(required=is_minor(owner.birth_date), consent=consent_out(item) if item else None)


@router.put("", summary="Загрузить или заменить согласие")
async def submit(
    body: Annotated[ConsentIn, Body()], user: CurrentUserDep, ip: ClientIp, consents: ConsentsDep
) -> ConsentOut:
    """Загружает или заменяет согласие представителя текущего пользователя."""
    return consent_out(await consents.submit(user.id, body.guardian_name, body.guardian_phone, body.file_id, ip))
