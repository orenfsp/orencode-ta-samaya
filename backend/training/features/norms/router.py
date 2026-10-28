from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query, status

from auth.dependencies import CurrentUser, CurrentUserDep, require_role
from core.request import ClientIp
from infrastructure.enums import Role, TrainingStage
from training.dependencies import StaffDep as Staff, NormsDep
from training.domain.norms import NormChange, ResultInput
from training.features.schemas import AttestationOut, HistoryOut, NormIn, NormOut, ResultOut, ResultsIn

router = APIRouter(tags=["Нормативы ФССП"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


def _change(body: NormIn) -> NormChange:
    """Переводит тело запроса в изменение норматива с перечнем присланных полей."""
    data = body.model_dump(exclude_unset=True)
    return NormChange(**data, fields=frozenset(data))


@router.get("/norms", summary="Справочник нормативов ОФП и СФП")
async def catalog(norms: NormsDep, stage: Annotated[TrainingStage | None, Query()] = None) -> list[NormOut]:
    """Публичный справочник действующих нормативов по этапам."""
    return [NormOut.of(item) for item in await norms.catalog(stage, False)]


@router.get("/admin/norms", summary="Нормативы с архивом")
async def admin_catalog(_: Federation, norms: NormsDep, stage: Annotated[TrainingStage | None, Query()] = None) -> list[NormOut]:
    """Справочник нормативов для федерации, включая архивные."""
    return [NormOut.of(item) for item in await norms.catalog(stage, True)]


@router.post("/admin/norms", status_code=status.HTTP_201_CREATED, summary="Добавить норматив")
async def create(body: Annotated[NormIn, Body()], user: Federation, ip: ClientIp, norms: NormsDep) -> NormOut:
    """Добавляет норматив в справочник."""
    return NormOut.of(await norms.create(user.id, _change(body), ip))


@router.patch("/admin/norms/{norm_id}", summary="Изменить норматив")
async def update(
    norm_id: Annotated[int, Path()], body: Annotated[NormIn, Body()], user: Federation, ip: ClientIp, norms: NormsDep
) -> NormOut:
    """Правит норматив или отправляет его в архив."""
    return NormOut.of(await norms.update(user.id, norm_id, _change(body), ip))


@router.post("/training/norm-results", status_code=status.HTTP_201_CREATED, summary="Внести результаты сдачи")
async def record(body: Annotated[ResultsIn, Body()], user: Staff, ip: ClientIp, norms: NormsDep) -> list[ResultOut]:
    """Принимает результаты; платформа сама отмечает, выполнен ли норматив."""
    items = [ResultInput(item.athlete_id, item.norm_id, item.value, item.passed_on) for item in body.items]
    return [ResultOut.of(item) for item in await norms.record(user.id, Role.FEDERATION in user.roles, items, ip)]


@router.get("/training/athletes/{athlete_id}/norms", summary="История нормативов и аттестаций спортсмена")
async def history(athlete_id: Annotated[UUID, Path()], user: CurrentUserDep, norms: NormsDep) -> HistoryOut:
    """История сдачи нормативов и аттестаций: спортсмену, его тренеру и федерации."""
    name, results, attestations = await norms.history(user.id, Role.FEDERATION in user.roles, athlete_id)
    return HistoryOut(athlete=name, results=[ResultOut.of(item) for item in results],
                      attestations=[AttestationOut.of(item) for item in attestations])
