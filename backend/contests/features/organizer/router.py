from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Path, Query, status

from auth.dependencies import CurrentUser, require_role
from contests.dependencies import ContestDep
from contests.features.organizer.schemas import (
    CancelIn,
    ContestIn,
    ContestOut,
    ContestPage,
    ContestPatch,
)
from contests.repositories.pg_contests import ContestQuery
from core.request import ClientIp
from infrastructure.enums import ContestStatus, Role, VerificationStatus

router = APIRouter(prefix="/organizer/contests", tags=["Соревнования: организатор"])

Organizer = Annotated[CurrentUser, Depends(require_role(Role.ORGANIZER))]
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


@router.get("", summary="Мои соревнования")
async def list_own(
    user: Organizer,
    contests: ContestDep,
    status_filter: Annotated[ContestStatus | None, Query(alias="status")] = None,
    verification_status: Annotated[VerificationStatus | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort: Annotated[str | None, Query(pattern="^(date_desc|date_asc|created_desc|title)$")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ContestPage:
    query = ContestQuery(
        statuses=frozenset({status_filter}) if status_filter else None,
        verification_status=verification_status,
        search=search,
        sort=sort,
    )
    items, total = await contests.list_for_organizer(user.id, query, limit, offset)
    return ContestPage(items=[ContestOut.model_validate(item) for item in items], total=total)


@router.get("/{contest_id}", summary="Моё соревнование")
async def get_own(contest_id: ContestId, user: Organizer, contests: ContestDep) -> ContestOut:
    return ContestOut.model_validate(await contests.get_for(user.id, False, contest_id))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Создать соревнование")
async def create(
    body: Annotated[ContestIn, Body()], user: Organizer, ip: ClientIp, contests: ContestDep
) -> ContestOut:
    return ContestOut.model_validate(await contests.create(user.id, False, body.model_dump(), ip))


@router.patch("/{contest_id}", summary="Изменить соревнование")
async def update(
    contest_id: ContestId,
    body: Annotated[ContestPatch, Body()],
    user: Organizer,
    ip: ClientIp,
    contests: ContestDep,
) -> ContestOut:
    fields = body.model_dump(exclude_unset=True)
    return ContestOut.model_validate(await contests.update(user.id, False, contest_id, fields, ip))


@router.delete("/{contest_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить соревнование")
async def delete(contest_id: ContestId, user: Organizer, ip: ClientIp, contests: ContestDep) -> None:
    await contests.delete(user.id, False, contest_id, ip)


@router.post("/{contest_id}/cancel", summary="Отменить")
async def cancel(
    contest_id: ContestId,
    body: Annotated[CancelIn, Body()],
    user: Organizer,
    ip: ClientIp,
    contests: ContestDep,
) -> ContestOut:
    item = await contests.transition(user.id, False, contest_id, "cancel", ip, body.reason)
    return ContestOut.model_validate(item)


@router.post("/{contest_id}/request-verification", summary="Запросить верификацию")
async def request_verification(
    contest_id: ContestId, user: Organizer, ip: ClientIp, contests: ContestDep
) -> ContestOut:
    return ContestOut.model_validate(await contests.request_verification(user.id, contest_id, ip))


def _add_action(path: str, title: str) -> None:
    action = path.replace("-", "_")

    async def run(contest_id: ContestId, user: Organizer, ip: ClientIp, contests: ContestDep) -> Any:
        return ContestOut.model_validate(await contests.transition(user.id, False, contest_id, action, ip))

    router.add_api_route(
        f"/{{contest_id}}/{path}",
        run,
        methods=["POST"],
        response_model=ContestOut,
        summary=title,
        name=f"organizer_{action}",
    )


for _path, _title in ACTIONS.items():
    _add_action(_path, _title)
