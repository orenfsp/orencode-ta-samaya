from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Path, Query

from infrastructure.base import DictionaryColumns
from ratings.dependencies import RatingsDep
from ratings.domain.ratings import Board, Line
from ratings.features.public.schemas import (
    AthleteOut,
    BoardList,
    BoardOut,
    ContestRefOut,
    LineOut,
    RefOut,
    ScoreOut,
    StandingList,
    StandingOut,
)

router = APIRouter(prefix="/ratings", tags=["Рейтинг спортсменов"])


def _ref(item: DictionaryColumns) -> RefOut:
    """Превращает запись справочника в краткую ссылочную схему."""
    return RefOut(id=item.id, name=item.name)


def _line(line: Line) -> LineOut:
    """Превращает строку рейтинга в схему ответа с данными спортсмена."""
    user = line.user
    return LineOut(
        place=line.place,
        athlete=AthleteOut(id=user.id, full_name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)),
        municipality=_ref(user.municipality) if user.municipality else None,
        points=line.points,
        contests=line.contests,
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


@router.get("", summary="Все рейтинги")
async def boards(
    ratings: RatingsDep,
    discipline_id: Annotated[int | None, Query(ge=1)] = None,
    municipality_id: Annotated[int | None, Query(ge=1)] = None,
    group_kind: Annotated[Literal["age", "academic"] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> BoardList:
    """Возвращает топ рейтинговых таблиц по всем дисциплинам и группам."""
    items = await ratings.boards(discipline_id, municipality_id, group_kind)
    return BoardList(items=[_board(board, board.lines[:limit], len(board.lines)) for board in items])


@router.get("/table", summary="Рейтинг целиком")
async def table(
    ratings: RatingsDep,
    discipline_id: Annotated[int, Query(ge=1)],
    group_kind: Annotated[Literal["age", "academic"], Query()],
    group_id: Annotated[int, Query(ge=1)],
    municipality_id: Annotated[int | None, Query(ge=1)] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BoardOut:
    """Возвращает страницу полной рейтинговой таблицы по дисциплине и группе с поиском по имени."""
    board = await ratings.board(discipline_id, group_kind, group_id, municipality_id)
    text = (search or "").strip().lower()
    lines = [
        line
        for line in board.lines
        if not text or text in f"{line.user.last_name} {line.user.first_name} {line.user.middle_name or ''}".lower()
    ]
    return _board(board, lines[offset : offset + limit], len(lines))


@router.get("/athletes/{user_id}", summary="Положение спортсмена в рейтингах")
async def athlete(user_id: Annotated[UUID, Path()], ratings: RatingsDep) -> StandingList:
    """Возвращает положение спортсмена во всех рейтингах с историей его результатов."""
    items = await ratings.athlete(user_id)
    return StandingList(
        items=[
            StandingOut(
                discipline=_ref(item.board.discipline),
                group_kind=item.board.kind,
                group=_ref(item.board.group),
                place=item.line.place,
                total=len(item.board.lines),
                points=item.line.points,
                contests=item.line.contests,
                scores=[
                    ScoreOut(
                        contest=ContestRefOut(id=score.contest_id, title=score.title, ends_on=score.ends_on),
                        place=score.place,
                        points=score.points,
                    )
                    for score in item.scores
                ],
            )
            for item in items
        ]
    )
