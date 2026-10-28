from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from infrastructure.enums import ContestStatus, ParticipationType


class AthleteOut(BaseModel):
    id: UUID
    full_name: str


class EntryOut(BaseModel):
    application_id: int
    team_name: str | None
    athletes: list[AthleteOut]
    entered: bool
    place: int | None


class ResultsFormOut(BaseModel):
    contest_id: int
    status: ContestStatus
    participation_type: ParticipationType
    editable: bool
    items: list[EntryOut]


class PlaceIn(BaseModel):
    application_id: int = Field(ge=1)
    place: int | None = Field(default=None, ge=1, le=100000)


class ResultsIn(BaseModel):
    items: list[PlaceIn] = Field(max_length=5000)
    source: str | None = Field(default=None, max_length=200)


class ImportRowOut(BaseModel):
    line: int
    name: str
    place: int | None
    disqualified: bool
    points: str | None
    status: Literal["matched", "doubtful", "unmatched"]
    application_id: int | None
    candidates: list[int]
    note: str | None


class ImportOut(BaseModel):
    file_name: str
    matched: int
    doubtful: int
    unmatched: int
    rows: list[ImportRowOut]
    entries: list[EntryOut]
    missing: list[int]
