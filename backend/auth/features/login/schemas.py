from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from infrastructure.enums import Role, RoleStatus


class LoginIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=255)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Role
    status: RoleStatus
    reject_reason: str | None
    onboarding_done: bool
    created_at: datetime


class LoginOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date
    roles: list[RoleOut]
