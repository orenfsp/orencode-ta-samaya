from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from qualifications.dependencies import QualificationsDep
from qualifications.features.schemas import MyQualifications, PersonOut, QualificationOut, SubmitIn

router = APIRouter(tags=["Разряды и категории: мои"])


@router.get("/me/qualifications", summary="Мои разряды и категории, а также поданные мной за спортсменов")
async def mine(user: CurrentUserDep, qualifications: QualificationsDep) -> MyQualifications:
    """Отдаёт разряды и категории текущего пользователя и то, что он подавал за других."""
    found = await qualifications.mine(user.id)
    return MyQualifications(
        items=[QualificationOut.of(item) for item in found.items],
        submitted=[QualificationOut.of(item) for item in found.submitted],
    )


@router.get("/me/athletes", summary="Спортсмены из заявок тренера")
async def athletes(user: CurrentUserDep, qualifications: QualificationsDep) -> list[PersonOut]:
    """Отдаёт спортсменов из заявок текущего тренера."""
    return [PersonOut.of(item) for item in await qualifications.athletes(user.id)]


@router.post("/qualifications", status_code=status.HTTP_201_CREATED, summary="Подать заявку на разряд или категорию")
async def submit(
    body: Annotated[SubmitIn, Body()], user: CurrentUserDep, ip: ClientIp, qualifications: QualificationsDep
) -> QualificationOut:
    """Подаёт заявку на разряд или категорию."""
    item = await qualifications.submit(
        user.id, user.roles, body.kind, body.user_id, body.item_id, body.document_file_id, body.basis, ip
    )
    return QualificationOut.of(item)


@router.post("/qualifications/{qualification_id}/withdraw", summary="Отозвать заявку")
async def withdraw(
    qualification_id: Annotated[UUID, Path()], user: CurrentUserDep, ip: ClientIp, qualifications: QualificationsDep
) -> QualificationOut:
    """Отзывает заявку на разряд или категорию."""
    return QualificationOut.of(await qualifications.withdraw(user.id, qualification_id, ip))
