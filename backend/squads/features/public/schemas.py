from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class RefOut(BaseModel):
    id: int
    name: str


class AthleteOut(BaseModel):
    id: UUID
    name: str


class MemberOut(BaseModel):
    position: int
    athlete: AthleteOut
    municipality: RefOut | None
    points: int


class OrderOut(BaseModel):
    number: str
    date: date
    url: str
    file_name: str


class SquadOut(BaseModel):
    id: int
    title: str
    discipline: RefOut
    group_kind: Literal["age", "academic"]
    group: RefOut
    main_size: int
    reserve_size: int
    order: OrderOut
    approved_at: datetime
    main: list[MemberOut]
    reserve: list[MemberOut]


class SquadList(BaseModel):
    items: list[SquadOut]


class BadgeOut(BaseModel):
    squad_id: int
    title: str
    discipline: RefOut
    group_kind: Literal["age", "academic"]
    group: RefOut
    link: str


class BadgeList(BaseModel):
    items: list[BadgeOut]
