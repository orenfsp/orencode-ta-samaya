from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from infrastructure.enums import Role, RoleStatus


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
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date
    academic_group: RefOut | None
    roles: list[RoleOut]
    available_roles: list[Role]


class RoleRequestIn(BaseModel):
    role: Role


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    academic_group_id: int | None = Field(ge=1)
