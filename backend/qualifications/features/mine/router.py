from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from qualifications.dependencies import QualificationsDep
from infrastructure.enums import QUALIFICATION_KIND_TITLES, QualificationStatus
from qualifications.domain.qualifications import today
from qualifications.features.schemas import (
    MyQualifications,
    PersonOut,
    QualificationOut,
    ResultChoiceOut,
    SubmitIn,
    VerifyOut,
)

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
        user.id, user.roles, body.kind, body.user_id, body.item_id, body.document_file_id, body.basis, ip,
        body.contest_result_id,
    )
    return QualificationOut.of(item)


@router.get("/me/qualification-results", summary="Места из истории выступлений для основания разряда")
async def results(
    user: CurrentUserDep, qualifications: QualificationsDep, user_id: Annotated[UUID | None, Query()] = None
) -> list[ResultChoiceOut]:
    """Возвращает места из протоколов, которые можно указать основанием разряда."""
    return [
        ResultChoiceOut(id=row.id, contest_title=contest.title, starts_on=contest.starts_on, place=row.place or 0,
                        points=row.points)
        for row, contest in await qualifications.results(user.id, user.roles, user_id)
    ]


@router.get("/verify/qualifications/{token}", summary="Проверка разряда или категории по QR")
async def verify(token: Annotated[str, Path(max_length=32)], qualifications: QualificationsDep) -> VerifyOut:
    """Публичная проверка разряда или категории по QR-токену."""
    item, valid = await qualifications.verify(token)
    user = item.user
    if item.status == QualificationStatus.SUPERSEDED:
        status = "Заменён более высокой ступенью"
    elif item.valid_until and item.valid_until < today():
        status = "Истёк"
    else:
        status = "Действует"
    initials = " ".join(f"{part[0]}." for part in (user.first_name, user.middle_name) if part)
    return VerifyOut(
        valid=valid, kind_title=QUALIFICATION_KIND_TITLES[item.kind], item_name=item.item_name,
        person=f"{user.last_name} {initials}", status=status, valid_from=item.valid_from,
        valid_until=item.valid_until, order_number=item.order_number, order_date=item.order_date,
    )


@router.post("/qualifications/{qualification_id}/withdraw", summary="Отозвать заявку")
async def withdraw(
    qualification_id: Annotated[UUID, Path()], user: CurrentUserDep, ip: ClientIp, qualifications: QualificationsDep
) -> QualificationOut:
    """Отзывает заявку на разряд или категорию."""
    return QualificationOut.of(await qualifications.withdraw(user.id, qualification_id, ip))
