from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from contests.dependencies import ContestDep
from contests.features.calendar.schemas import ContestOut, ContestPage
from contests.repositories.pg_contests import ContestQuery
from infrastructure.enums import ContestStatus, ParticipationType

router = APIRouter(prefix="/contests", tags=["Соревнования: календарь"])


def calendar_query(
    discipline_id: Annotated[int | None, Query()] = None,
    contest_level_id: Annotated[int | None, Query()] = None,
    contest_format_id: Annotated[int | None, Query()] = None,
    participation_type: Annotated[ParticipationType | None, Query()] = None,
    age_group_id: Annotated[int | None, Query()] = None,
    academic_group_id: Annotated[int | None, Query()] = None,
    municipality_id: Annotated[int | None, Query()] = None,
    status: Annotated[ContestStatus | None, Query()] = None,
    verified_only: Annotated[bool, Query()] = False,
    has_prize_fund: Annotated[bool, Query()] = False,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort: Annotated[str | None, Query(pattern="^(date_desc|date_asc|created_desc|title)$")] = None,
    period: Annotated[str, Query(pattern="^(upcoming|past|all)$")] = "upcoming",
) -> ContestQuery:
    return ContestQuery(
        statuses=frozenset({status}) if status else None,
        discipline_id=discipline_id,
        contest_level_id=contest_level_id,
        contest_format_id=contest_format_id,
        participation_type=participation_type,
        age_group_id=age_group_id,
        academic_group_id=academic_group_id,
        municipality_id=municipality_id,
        verified_only=verified_only,
        has_prize_fund=has_prize_fund,
        date_from=date_from,
        date_to=date_to,
        search=search,
        period=None if period == "all" else period,
        sort=sort,
    )


@router.get("", summary="Календарь соревнований")
async def list_contests(
    query: Annotated[ContestQuery, Depends(calendar_query)],
    contests: ContestDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ContestPage:
    items, total = await contests.list_public(query, limit, offset)
    return ContestPage(items=[ContestOut.model_validate(item) for item in items], total=total)


@router.get("/{contest_id}", summary="Карточка соревнования")
async def get_contest(
    contest_id: Annotated[int, Path()],
    contests: ContestDep,
) -> ContestOut:
    return ContestOut.model_validate(await contests.get_public(contest_id))
