from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from infrastructure.enums import Role, TrainingStage
from training.dependencies import GroupsDep, StaffDep as Staff
from training.domain.groups import GroupChange, GroupFilter, Move
from training.features.schemas import EnrollIn, EnrollmentOut, GroupDetailOut, GroupIn, GroupOut, MoveIn, TransferIn

router = APIRouter(prefix="/training", tags=["Учебно-тренировочные группы"])


GroupId = Annotated[int, Path()]
EnrollmentId = Annotated[UUID, Path()]


@router.get("/groups", summary="Группы: федерация — все, тренер — свои")
async def search(
    user: Staff,
    groups: GroupsDep,
    organization_id: Annotated[int | None, Query()] = None,
    coach_id: Annotated[UUID | None, Query()] = None,
    discipline_id: Annotated[int | None, Query()] = None,
    stage: Annotated[TrainingStage | None, Query()] = None,
    active_only: Annotated[bool, Query()] = True,
) -> list[GroupOut]:
    """Возвращает группы по фильтрам с числом занимающихся."""
    items, sizes = await groups.search(
        user.id, Role.FEDERATION in user.roles,
        GroupFilter(organization_id, coach_id, discipline_id, stage, active_only),
    )
    return [GroupOut.of(item, sizes.get(item.id, 0)) for item in items]


@router.post("/groups", status_code=status.HTTP_201_CREATED, summary="Создать группу")
async def create(body: Annotated[GroupIn, Body()], user: Staff, ip: ClientIp, groups: GroupsDep) -> GroupOut:
    """Создаёт группу по действующей программе организации."""
    item = await groups.create(user.id, Role.FEDERATION in user.roles, GroupChange(**body.model_dump()), ip)
    return GroupOut.of(item)


@router.get("/groups/{group_id}", summary="Группа: состав и история зачислений")
async def get(group_id: GroupId, user: Staff, groups: GroupsDep) -> GroupDetailOut:
    """Возвращает группу, текущий состав и прошлые зачисления."""
    group, enrollments = await groups.get(user.id, Role.FEDERATION in user.roles, group_id)
    current = [EnrollmentOut.of(item) for item in enrollments if item.valid_to is None]
    return GroupDetailOut(
        group=GroupOut.of(group, len(current)),
        current=sorted(current, key=lambda item: item.athlete.name),
        history=[EnrollmentOut.of(item) for item in enrollments if item.valid_to is not None],
    )


@router.patch("/groups/{group_id}", summary="Изменить группу")
async def update(
    group_id: GroupId, body: Annotated[GroupIn, Body()], user: Staff, ip: ClientIp, groups: GroupsDep
) -> GroupOut:
    """Меняет название, тренера или закрывает группу."""
    data = body.model_dump(include={"name", "coach_id", "is_active"}, exclude_unset=True)
    item = await groups.update(user.id, Role.FEDERATION in user.roles, group_id, GroupChange(**data), ip)
    return GroupOut.of(item)


@router.post("/groups/{group_id}/enrollments", status_code=status.HTTP_201_CREATED, summary="Зачислить спортсмена")
async def enroll(
    group_id: GroupId, body: Annotated[EnrollIn, Body()], user: Staff, ip: ClientIp, groups: GroupsDep
) -> EnrollmentOut:
    """Зачисляет спортсмена в группу с даты приказа."""
    item = await groups.enroll(user.id, Role.FEDERATION in user.roles, group_id, body.athlete_id,
                               Move(body.on, body.order_number, body.note), ip)
    return EnrollmentOut.of(item)


@router.post("/enrollments/{enrollment_id}/transfer", summary="Перевести в другую группу")
async def transfer(
    enrollment_id: EnrollmentId, body: Annotated[TransferIn, Body()], user: Staff, ip: ClientIp, groups: GroupsDep
) -> EnrollmentOut:
    """Переводит спортсмена в другую группу той же дисциплины."""
    item = await groups.transfer(user.id, Role.FEDERATION in user.roles, enrollment_id, body.target_group_id,
                                 Move(body.on, body.order_number, body.note), ip)
    return EnrollmentOut.of(item)


@router.post("/enrollments/{enrollment_id}/expel", summary="Отчислить из группы")
async def expel(
    enrollment_id: EnrollmentId, body: Annotated[MoveIn, Body()], user: Staff, ip: ClientIp, groups: GroupsDep
) -> EnrollmentOut:
    """Отчисляет спортсмена из группы с даты приказа."""
    item = await groups.expel(user.id, Role.FEDERATION in user.roles, enrollment_id,
                              Move(body.on, body.order_number, body.note), ip)
    return EnrollmentOut.of(item)


@router.get("/athletes/{athlete_id}/enrollments", summary="История зачислений спортсмена")
async def history(athlete_id: Annotated[UUID, Path()], user: CurrentUserDep, groups: GroupsDep) -> list[EnrollmentOut]:
    """История групп спортсмена: ему самому, его тренеру и федерации."""
    return [EnrollmentOut.of(item) for item in await groups.history(user.id, Role.FEDERATION in user.roles, athlete_id)]
