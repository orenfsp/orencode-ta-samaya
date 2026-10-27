from datetime import date, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from infrastructure.enums import Role, RoleStatus


class RequestState(StrEnum):
    PENDING = "pending"
    DECIDED = "decided"


class RequestUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date


class DeciderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    last_name: str
    first_name: str


class RoleRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user: RequestUserOut
    role: Role
    status: RoleStatus
    reject_reason: str | None
    created_at: datetime
    decided_at: datetime | None
    decided_by: DeciderOut | None = Field(validation_alias="decider")


class RoleRequestPage(BaseModel):
    items: list[RoleRequestOut]
    total: int


class RoleRequestCounts(BaseModel):
    pending: dict[Role, int]


class RejectIn(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class ResetIn(BaseModel):
    reason: Annotated[str | None, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)] = None
