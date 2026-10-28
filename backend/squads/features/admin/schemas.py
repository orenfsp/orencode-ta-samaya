from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class RefOut(BaseModel):
    id: int
    name: str


class CandidateOut(BaseModel):
    position: int
    athlete_id: UUID
    name: str
    municipality: RefOut | None
    points: int


class CurrentOut(BaseModel):
    id: int
    order_number: str
    order_date: date
    main: int
    reserve: int


class DraftOut(BaseModel):
    title: str
    discipline: RefOut
    group_kind: Literal["age", "academic"]
    group: RefOut
    main_size: int
    reserve_size: int
    available: int
    main: list[CandidateOut]
    reserve: list[CandidateOut]
    current: CurrentOut | None


class SquadIn(BaseModel):
    discipline_id: int = Field(ge=1)
    group_kind: Literal["age", "academic"]
    group_id: int = Field(ge=1)
    main_size: int = Field(ge=1, le=100)
    reserve_size: int = Field(ge=0, le=100)
    order_number: str = Field(max_length=100)
    order_date: date
    order_file_id: UUID


class ApprovedOut(BaseModel):
    id: int
    title: str
    link: str
    main: int
    reserve: int
