from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from qualifications.dependencies import JudgesDep
from qualifications.features.judges.schemas import (
    AssignIn,
    AssignmentOut,
    CandidateOut,
    CategoryOut,
    ContestRefOut,
    MyAssignmentOut,
    PanelOut,
    PositionIn,
    PositionOut,
)
from qualifications.features.schemas import PersonOut

router = APIRouter(tags=["Судейские коллегии"])
ContestId = Annotated[int, Path()]
AssignmentId = Annotated[UUID, Path()]


async def _panel(judges: JudgesDep, contest_id: int) -> PanelOut:
    """Собирает схему коллегии судей соревнования."""
    panel = await judges.of_contest(contest_id)
    return PanelOut(
        contest_id=panel.contest.id,
        starts_on=panel.contest.starts_on,
        items=[
            AssignmentOut.of(item, panel.categories.get(item.judge_id), panel.conflicts.get(item.judge_id))
            for item in panel.items
        ],
    )


@router.get("/contests/{contest_id}/judges", summary="Судейская коллегия соревнования")
async def panel(contest_id: ContestId, judges: JudgesDep) -> PanelOut:
    """Отдаёт судейскую коллегию соревнования."""
    return await _panel(judges, contest_id)


@router.get("/contests/{contest_id}/judges/candidates", summary="Судьи для назначения")
async def candidates(
    contest_id: ContestId, user: CurrentUserDep, judges: JudgesDep, q: Annotated[str | None, Query(max_length=100)] = None
) -> list[CandidateOut]:
    """Подбирает судей для назначения в коллегию соревнования."""
    return [
        CandidateOut(judge=PersonOut.of(item.user), category=CategoryOut.of(item.category), conflicts=item.conflicts)
        for item in await judges.candidates(user.id, user.roles, contest_id, q)
    ]


@router.post("/contests/{contest_id}/judges", status_code=status.HTTP_201_CREATED, summary="Назначить судью")
async def assign(
    contest_id: ContestId, body: Annotated[AssignIn, Body()], user: CurrentUserDep, ip: ClientIp, judges: JudgesDep
) -> PanelOut:
    """Назначает судью в коллегию соревнования и отдаёт обновлённую коллегию."""
    await judges.assign(user.id, user.roles, contest_id, body.judge_id, body.position_id, ip)
    return await _panel(judges, contest_id)


@router.patch("/contests/{contest_id}/judges/{assignment_id}", summary="Сменить должность")
async def update(
    contest_id: ContestId,
    assignment_id: AssignmentId,
    body: Annotated[PositionIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    judges: JudgesDep,
) -> PanelOut:
    """Меняет должность судьи в коллегии и отдаёт обновлённую коллегию."""
    await judges.update(user.id, user.roles, contest_id, assignment_id, body.position_id, ip)
    return await _panel(judges, contest_id)


@router.delete("/contests/{contest_id}/judges/{assignment_id}", summary="Снять судью")
async def remove(
    contest_id: ContestId, assignment_id: AssignmentId, user: CurrentUserDep, ip: ClientIp, judges: JudgesDep
) -> PanelOut:
    """Снимает судью с коллегии и отдаёт обновлённую коллегию."""
    await judges.remove(user.id, user.roles, contest_id, assignment_id, ip)
    return await _panel(judges, contest_id)


@router.get("/me/judge-assignments", summary="Мои назначения судьёй")
async def mine(user: CurrentUserDep, judges: JudgesDep) -> list[MyAssignmentOut]:
    """Отдаёт назначения текущего пользователя судьёй."""
    return [
        MyAssignmentOut(
            id=item.id,
            contest=ContestRefOut(
                id=item.contest.id,
                title=item.contest.title,
                starts_on=item.contest.starts_on,
                ends_on=item.contest.ends_on,
                status=item.contest.status.value,
            ),
            position=PositionOut(id=item.position.id, name=item.position.name),
        )
        for item in await judges.of_judge(user.id)
    ]
