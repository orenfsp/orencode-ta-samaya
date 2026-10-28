from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from infrastructure.enums import CodeforcesStatus, Role, RoleStatus


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Role
    status: RoleStatus
    reject_reason: str | None
    onboarding_done: bool
    created_at: datetime


class RefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    email_verified: bool
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date
    academic_group: RefOut | None
    roles: list[RoleOut]
    available_roles: list[Role]
    codeforces: "CodeforcesOut | None" = None


class RoleRequestIn(BaseModel):
    role: Role


NamePart = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    academic_group_id: int | None = Field(default=None, ge=1)
    last_name: NamePart | None = None
    first_name: NamePart | None = None
    middle_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    birth_date: date | None = None

    @field_validator("birth_date")
    @classmethod
    def check_birth_date(cls, value: date | None) -> date | None:
        """Проверяет, что дата рождения не в будущем и не раньше 1900 года."""
        if value is not None and value > date.today():
            raise ValueError("Дата рождения в будущем")
        if value is not None and value < date(1900, 1, 1):
            raise ValueError("Слишком ранняя дата рождения")
        return value


class CodeforcesOut(BaseModel):
    handle: str
    url: str
    rating: int | None
    max_rating: int | None
    rank: str | None
    status: CodeforcesStatus
    updated_at: datetime | None


MeOut.model_rebuild()
