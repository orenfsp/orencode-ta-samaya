from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field

from infrastructure.enums import (
    APPLICATION_STATUS_TITLES,
    CONTEST_STATUS_TITLES,
    MEMBER_CONFIRMATION_TITLES,
    PARTICIPATION_TYPE_TITLES,
    ApplicationCreator,
    ApplicationStatus,
    ContestStatus,
    MemberConfirmation,
    ParticipationType,
)

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
Ids = Annotated[list[int], Field(min_length=1, max_length=200)]


class RefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date


class ContestRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    discipline: RefOut
    participation_type: ParticipationType
    team_size_min: int | None
    team_size_max: int | None
    starts_on: date
    ends_on: date
    registration_closes_at: datetime
    status: ContestStatus
    organizer: PersonOut

    @computed_field
    @property
    def status_title(self) -> str:
        """Возвращает человекочитаемое название статуса соревнования."""
        return CONTEST_STATUS_TITLES[self.status]

    @computed_field
    @property
    def participation_type_title(self) -> str:
        """Возвращает человекочитаемое название типа участия."""
        return PARTICIPATION_TYPE_TITLES[self.participation_type]


class ContestCountsOut(BaseModel):
    contest: ContestRowOut
    counts: dict[ApplicationStatus, int]


class ContestCountsPage(BaseModel):
    items: list[ContestCountsOut]
    total: int


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: PersonOut
    is_captain: bool
    confirmation: MemberConfirmation
    is_active: bool
    age_group: RefOut | None
    academic_group: RefOut | None

    @computed_field
    @property
    def confirmation_title(self) -> str:
        """Возвращает человекочитаемое название статуса подтверждения участника."""
        return MEMBER_CONFIRMATION_TITLES[self.confirmation]


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contest_id: int
    team_name: str | None
    status: ApplicationStatus
    created_as: ApplicationCreator
    creator: PersonOut
    reject_reason: str | None
    decider: PersonOut | None = Field(serialization_alias="decided_by")
    submitted_at: datetime | None
    decided_at: datetime | None
    created_at: datetime
    members: list[MemberOut]

    @computed_field
    @property
    def status_title(self) -> str:
        """Возвращает человекочитаемое название статуса заявки."""
        return APPLICATION_STATUS_TITLES[self.status]


class ApplicationPage(BaseModel):
    items: list[ApplicationOut]
    total: int


class ApplicationList(BaseModel):
    items: list[ApplicationOut]


class IdsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: Ids


class RejectIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Reason


class RejectManyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: Ids
    reason: Reason
