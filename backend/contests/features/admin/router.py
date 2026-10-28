from datetime import date
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query, status

from auth.dependencies import CurrentUser, require_role
from contests.dependencies import ContestDep
from contests.features.admin.schemas import (
    AdminContestIn,
    AdminContestPatch,
    CancelIn,
    ContestOut,
    ContestPage,
    LevelPointsOut,
    RatingPointOut,
    RatingPointsIn,
    ReasonIn,
    RefOut,
    VerifyIn,
)
from contests.repositories.pg_contests import ContestQuery
from core.request import ClientIp
from infrastructure.enums import ContestStatus, ParticipationType, Role, VerificationStatus

router = APIRouter(prefix="/admin/contests", tags=["Соревнования: федерация"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
ContestId = Annotated[int, Path()]

ACTIONS = {
    "publish": "Опубликовать",
    "unpublish": "Снять с публикации",
    "open-registration": "Открыть регистрацию",
    "close-registration": "Закрыть регистрацию",
    "start": "Начать",
    "complete": "Завершить",
    "archive": "В архив",
}


def admin_query(
    status_filter: Annotated[ContestStatus | None, Query(alias="status")] = None,
    verification_status: Annotated[VerificationStatus | None, Query()] = None,
    organizer_id: Annotated[UUID | None, Query()] = None,
    discipline_id: Annotated[int | None, Query()] = None,
    contest_level_id: Annotated[int | None, Query()] = None,
    contest_format_id: Annotated[int | None, Query()] = None,
    participation_type: Annotated[ParticipationType | None, Query()] = None,
    age_group_id: Annotated[int | None, Query()] = None,
    academic_group_id: Annotated[int | None, Query()] = None,
    municipality_id: Annotated[int | None, Query()] = None,
    has_prize_fund: Annotated[bool, Query()] = False,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort: Annotated[str | None, Query(pattern="^(date_desc|date_asc|created_desc|title)$")] = None,
) -> ContestQuery:
    """Собирает параметры фильтра списка соревнований из query-параметров запроса."""
    return ContestQuery(
        statuses=frozenset({status_filter}) if status_filter else None,
        verification_status=verification_status,
        organizer_id=organizer_id,
        discipline_id=discipline_id,
        contest_level_id=contest_level_id,
        contest_format_id=contest_format_id,
        participation_type=participation_type,
        age_group_id=age_group_id,
        academic_group_id=academic_group_id,
        municipality_id=municipality_id,
        has_prize_fund=has_prize_fund,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort=sort,
    )


@router.get("", summary="Все соревнования")
async def list_all(
    user: Federation,
    query: Annotated[ContestQuery, Depends(admin_query)],
    contests: ContestDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ContestPage:
    """Возвращает страницу всех соревнований для федерации по фильтру."""
    items, total = await contests.list_all(query, limit, offset)
    return ContestPage(items=[ContestOut.model_validate(item) for item in items], total=total)


@router.get("/rating-points-defaults", summary="Баллы за места по умолчанию для уровней")
async def rating_points_defaults(user: Federation, contests: ContestDep) -> list[LevelPointsOut]:
    """Возвращает баллы рейтинга по умолчанию за места для каждого уровня соревнований."""
    return [
        LevelPointsOut(
            level=RefOut.model_validate(level),
            rating_points=[RatingPointOut(**point) for point in points],
        )
        for level, points in await contests.default_rating_points()
    ]


@router.get("/{contest_id}", summary="Соревнование")
async def get_one(contest_id: ContestId, user: Federation, contests: ContestDep) -> ContestOut:
    """Возвращает соревнование по id."""
    return ContestOut.model_validate(await contests.get_for(user.id, True, contest_id))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Создать соревнование")
async def create(
    body: Annotated[AdminContestIn, Body()], user: Federation, ip: ClientIp, contests: ContestDep
) -> ContestOut:
    """Создаёт соревнование от имени федерации, можно с указанием организатора."""
    return ContestOut.model_validate(await contests.create(user.id, True, body.model_dump(), ip))


@router.patch("/{contest_id}", summary="Изменить соревнование")
async def update(
    contest_id: ContestId,
    body: Annotated[AdminContestPatch, Body()],
    user: Federation,
    ip: ClientIp,
    contests: ContestDep,
) -> ContestOut:
    """Обновляет указанные поля соревнования."""
    fields = body.model_dump(exclude_unset=True)
    return ContestOut.model_validate(await contests.update(user.id, True, contest_id, fields, ip))


@router.delete("/{contest_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить соревнование")
async def delete(contest_id: ContestId, user: Federation, ip: ClientIp, contests: ContestDep) -> None:
    """Удаляет соревнование."""
    await contests.delete(user.id, True, contest_id, ip)


@router.post("/{contest_id}/cancel", summary="Отменить")
async def cancel(
    contest_id: ContestId,
    body: Annotated[CancelIn, Body()],
    user: Federation,
    ip: ClientIp,
    contests: ContestDep,
) -> ContestOut:
    """Отменяет соревнование с указанием причины."""
    item = await contests.transition(user.id, True, contest_id, "cancel", ip, body.reason)
    return ContestOut.model_validate(item)


@router.post("/{contest_id}/verify", summary="Верифицировать")
async def verify(
    contest_id: ContestId,
    user: Federation,
    ip: ClientIp,
    contests: ContestDep,
    body: Annotated[VerifyIn | None, Body()] = None,
) -> ContestOut:
    """Верифицирует соревнование, задавая баллы рейтинга за места (или по умолчанию для уровня)."""
    points = [point.model_dump() for point in body.rating_points] if body and body.rating_points else None
    return ContestOut.model_validate(await contests.verify(user.id, contest_id, points, ip))


@router.patch("/{contest_id}/rating-points", summary="Изменить баллы за места")
async def set_rating_points(
    contest_id: ContestId,
    body: Annotated[RatingPointsIn, Body()],
    user: Federation,
    ip: ClientIp,
    contests: ContestDep,
) -> ContestOut:
    """Пытается изменить баллы рейтинга соревнования; на верифицированном соревновании всегда запрещено."""
    points = [point.model_dump() for point in body.rating_points]
    return ContestOut.model_validate(await contests.set_rating_points(user.id, contest_id, points, ip))


@router.post("/{contest_id}/reject-verification", summary="Отказать в верификации")
async def reject_verification(
    contest_id: ContestId,
    body: Annotated[ReasonIn, Body()],
    user: Federation,
    ip: ClientIp,
    contests: ContestDep,
) -> ContestOut:
    """Отказывает в верификации соревнования с указанием причины."""
    item = await contests.reject_verification(user.id, contest_id, body.reason, ip)
    return ContestOut.model_validate(item)


@router.post("/{contest_id}/revoke-verification", summary="Снять верификацию")
async def revoke_verification(
    contest_id: ContestId, user: Federation, ip: ClientIp, contests: ContestDep
) -> ContestOut:
    """Снимает верификацию с соревнования."""
    return ContestOut.model_validate(await contests.revoke_verification(user.id, contest_id, ip))


def _add_action(path: str, title: str) -> None:
    """Регистрирует POST-эндпоинт для простого перехода статуса соревнования по имени действия."""
    action = path.replace("-", "_")

    async def run(contest_id: ContestId, user: Federation, ip: ClientIp, contests: ContestDep) -> Any:
        """Выполняет переход статуса соревнования и возвращает обновлённое соревнование."""
        return ContestOut.model_validate(await contests.transition(user.id, True, contest_id, action, ip))

    router.add_api_route(
        f"/{{contest_id}}/{path}",
        run,
        methods=["POST"],
        response_model=ContestOut,
        summary=title,
        name=f"admin_{action}",
    )


for _path, _title in ACTIONS.items():
    _add_action(_path, _title)
