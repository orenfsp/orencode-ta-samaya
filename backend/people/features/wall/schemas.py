from datetime import date
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from infrastructure.enums import ContestStatus, ParticipationType


class RefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ContestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    discipline: RefOut
    contest_level: RefOut
    contest_format: RefOut
    participation_type: ParticipationType
    starts_on: date
    ends_on: date
    status: ContestStatus


class PhotoOut(BaseModel):
    id: UUID
    url: str


class PostOut(BaseModel):
    id: UUID
    text: str | None
    photos: list[PhotoOut]
    is_hidden: bool
    hidden_by_federation: bool


class EntryOut(BaseModel):
    contest: ContestOut
    team_name: str | None
    athletes: int | None
    place: int | None
    disqualified: bool
    position: str | None = None
    post: PostOut | None


class WallList(BaseModel):
    items: list[EntryOut]
    total: int


class PostIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str, StringConstraints(max_length=2000)] | None = None
    photo_ids: Annotated[list[UUID], Field(max_length=10)] = []
    is_hidden: bool = False


class SavedOut(BaseModel):
    id: UUID
    contest_id: int
    text: str | None
    is_hidden: bool
