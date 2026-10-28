from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from infrastructure.enums import CodeforcesStatus, Role


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class CodeforcesOut(BaseModel):
    handle: str
    url: str
    rating: int | None
    max_rating: int | None
    rank: str | None
    status: CodeforcesStatus
    updated_at: datetime | None


class PersonOut(BaseModel):
    id: UUID
    name: str
    last_name: str | None
    first_name: str
    middle_name: str | None
    birth_date: date | None
    academic_group: GroupOut | None
    avatar_url: str | None
    roles: list[Role]
    is_owner: bool
    masked: bool
    codeforces: CodeforcesOut | None


class PageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    avatar_file_id: UUID | None = None
