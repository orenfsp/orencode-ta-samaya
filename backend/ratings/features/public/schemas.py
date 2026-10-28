from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RefOut(BaseModel):
    id: int
    name: str


class AthleteOut(BaseModel):
    id: UUID
    full_name: str


class LineOut(BaseModel):
    place: int
    athlete: AthleteOut
    municipality: RefOut | None
    points: int
    contests: int


class BoardOut(BaseModel):
    discipline: RefOut
    group_kind: Literal["age", "academic"]
    group: RefOut
    total: int
    items: list[LineOut]


class BoardList(BaseModel):
    items: list[BoardOut]


class ContestRefOut(BaseModel):
    id: int
    title: str
    ends_on: date


class ScoreOut(BaseModel):
    contest: ContestRefOut
    place: int | None
    points: int


class StandingOut(BaseModel):
    discipline: RefOut
    group_kind: Literal["age", "academic"]
    group: RefOut
    place: int
    total: int
    points: int
    contests: int
    scores: list[ScoreOut]


class StandingList(BaseModel):
    items: list[StandingOut]
