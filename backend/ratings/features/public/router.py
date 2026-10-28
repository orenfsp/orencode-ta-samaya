from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Path, Query

from auth.dependencies import CurrentUserDep
from infrastructure.base import DictionaryColumns
from infrastructure.enums import RATING_SEASON_TITLES
from ratings.dependencies import RatingsDep
from ratings.domain.ratings import Board, Line, Rules, Standing
from ratings.features.public.schemas import (
    AthleteOut,
    BoardList,
    BoardOut,
    ContestRefOut,
    LineOut,
    ReasonOut,
    RefOut,
    RulesOut,
    ScoreOut,
    StandingList,
    StandingOut,
    StatusOut,
)

router = APIRouter(prefix="/ratings", tags=["Рейтинг спортсменов"])

MinRank = Annotated[int | None, Query(ge=1, description="Не ниже этого разряда: id из справочника разрядов")]


def _ref(item: DictionaryColumns) -> RefOut:
    """Превращает запись справочника в краткую ссылочную схему."""
    return RefOut(id=item.id, name=item.name)


def _line(line: Line) -> LineOut:
    """Превращает строку рейтинга в схему ответа с данными спортсмена и расшифровкой итога."""
    user = line.user
    return LineOut(
        place=line.place,
        athlete=AthleteOut(id=user.id, full_name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)),
        municipality=_ref(user.municipality) if user.municipality else None,
        points=line.points,
        contests=line.contests,
        base=line.base,
        podiums=line.podiums,
        factor=float(line.factor) if line.factor else None,
        explain=line.explain,
    )


def _board(board: Board, lines: list[Line], total: int) -> BoardOut:
    """Превращает рейтинговую таблицу и страницу её строк в схему ответа."""
    return BoardOut(
        discipline=_ref(board.discipline),
        group_kind=board.kind,
        group=_ref(board.group),
        total=total,
        items=[_line(line) for line in lines],
    )


def _standing(item: Standing) -> StandingOut:
    """Превращает положение спортсмена в рейтинге в схему с историей результатов."""
    line = item.line
    return StandingOut(
        discipline=_ref(item.board.discipline),
        group_kind=item.board.kind,
        group=_ref(item.board.group),
        place=line.place,
        total=len(item.board.lines),
        points=line.points,
        contests=line.contests,
        base=line.base,
        podiums=line.podiums,
        factor=float(line.factor) if line.factor else None,
        explain=line.explain,
        scores=[
            ScoreOut(
                contest=ContestRefOut(id=score.contest_id, title=score.title, ends_on=score.ends_on),
                place=score.place,
                points=score.points,
            )
            for score in item.scores
        ],
    )


def rules_out(rules: Rules, since: date) -> RulesOut:
    """Превращает правила рейтинга в схему ответа."""
    return RulesOut(
        stability_factor=float(rules.factor),
        podium_place=rules.podium_place,
        podium_count=rules.podium_count,
        season=rules.season,
        season_title=RATING_SEASON_TITLES[rules.season],
        since=since,
        formula=rules.formula,
    )


@router.get("", summary="Все рейтинги")
async def boards(
    ratings: RatingsDep,
    discipline_id: Annotated[int | None, Query(ge=1)] = None,
    municipality_id: Annotated[int | None, Query(ge=1)] = None,
    group_kind: Annotated[Literal["age", "academic"] | None, Query()] = None,
    min_rank_id: MinRank = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> BoardList:
    """Возвращает топ рейтинговых таблиц по всем дисциплинам и группам."""
    items = await ratings.boards(discipline_id, municipality_id, group_kind, min_rank_id)
    return BoardList(items=[_board(board, board.lines[:limit], len(board.lines)) for board in items])


@router.get("/settings", summary="Правила подсчёта рейтинга")
async def settings(ratings: RatingsDep) -> RulesOut:
    """Возвращает действующие правила рейтинга и начало текущего сезона."""
    rules = await ratings.rules()
    return rules_out(rules, ratings.since(ratings.today(), rules.season))


@router.get("/table", summary="Рейтинг целиком")
async def table(
    ratings: RatingsDep,
    discipline_id: Annotated[int, Query(ge=1)],
    group_kind: Annotated[Literal["age", "academic"], Query()],
    group_id: Annotated[int, Query(ge=1)],
    municipality_id: Annotated[int | None, Query(ge=1)] = None,
    min_rank_id: MinRank = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BoardOut:
    """Возвращает страницу полной рейтинговой таблицы по дисциплине и группе с поиском по имени."""
    board = await ratings.board(discipline_id, group_kind, group_id, municipality_id, min_rank_id)
    text = (search or "").strip().lower()
    lines = [
        line
        for line in board.lines
        if not text or text in f"{line.user.last_name} {line.user.first_name} {line.user.middle_name or ''}".lower()
    ]
    return _board(board, lines[offset : offset + limit], len(lines))


@router.get("/me", summary="Моё место в рейтингах или почему меня там нет")
async def me(user: CurrentUserDep, ratings: RatingsDep) -> StatusOut:
    """Возвращает положение текущего пользователя в рейтингах и причины, по которым его нет в части из них."""
    status = await ratings.status(user.id)
    return StatusOut(
        rules=rules_out(status.rules, status.since),
        in_rating=bool(status.standings),
        standings=[_standing(item) for item in status.standings],
        reasons=[ReasonOut(code=item.code, text=item.text) for item in status.reasons],
    )


@router.get("/athletes/{user_id}", summary="Положение спортсмена в рейтингах")
async def athlete(user_id: Annotated[UUID, Path()], ratings: RatingsDep) -> StandingList:
    """Возвращает положение спортсмена во всех рейтингах с историей его результатов."""
    return StandingList(items=[_standing(item) for item in await ratings.athlete(user_id)])
