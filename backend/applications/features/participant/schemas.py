from datetime import date, datetime
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field

from core.config import settings
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
    VerificationStatus,
)

TeamName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_name: str
    content_type: str
    size: int
    is_public: bool = Field(exclude=True)
    object_key: str = Field(exclude=True)

    @computed_field
    @property
    def url(self) -> str:
        if self.is_public:
            return f"{settings.s3_public_url}/{settings.s3_public_bucket}/{quote(self.object_key)}"
        return f"/api/v1/files/{self.id}"


class ContestBriefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    discipline: RefOut
    contest_level: RefOut
    contest_format: RefOut
    participation_type: ParticipationType
    team_size_min: int | None
    team_size_max: int | None
    municipality: RefOut | None
    venue: str | None
    age_groups: list[RefOut]
    academic_groups: list[RefOut]
    starts_on: date
    ends_on: date
    registration_opens_at: datetime
    registration_closes_at: datetime
    prize_fund_text: str | None
    prize_fund_amount: int | None
    status: ContestStatus
    verification_status: VerificationStatus = Field(exclude=True)
    photos: list[FileOut] = Field(validation_alias="photo_files")

    @computed_field
    @property
    def status_title(self) -> str:
        return CONTEST_STATUS_TITLES[self.status]

    @computed_field
    @property
    def participation_type_title(self) -> str:
        return PARTICIPATION_TYPE_TITLES[self.participation_type]

    @computed_field
    @property
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date
    academic_group: RefOut | None


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: PersonOut
    is_captain: bool
    confirmation: MemberConfirmation
    is_active: bool
    age_group: RefOut | None
    academic_group: RefOut | None
    responded_at: datetime | None

    @computed_field
    @property
    def confirmation_title(self) -> str:
        return MEMBER_CONFIRMATION_TITLES[self.confirmation]


class CreatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    last_name: str
    first_name: str
    middle_name: str | None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contest: ContestBriefOut
    team_name: str | None
    status: ApplicationStatus
    created_as: ApplicationCreator
    creator: CreatorOut
    reject_reason: str | None
    submitted_at: datetime | None
    decided_at: datetime | None
    created_at: datetime
    members: list[MemberOut]

    @computed_field
    @property
    def status_title(self) -> str:
        return APPLICATION_STATUS_TITLES[self.status]


class ApplicationList(BaseModel):
    items: list[ApplicationOut]


class AvailableOut(BaseModel):
    contest: ContestBriefOut
    problems: list[str]


class AvailableList(BaseModel):
    items: list[AvailableOut]


class AthleteOut(PersonOut):
    problems: list[str] | None = None


class AthleteList(BaseModel):
    items: list[AthleteOut]


class ApplicationIn(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    as_: ApplicationCreator = Field(alias="as")
    team_name: TeamName | None = None
    member_ids: list[UUID] = Field(default_factory=list, max_length=100)
    captain_id: UUID | None = None


class AthletesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    member_ids: list[UUID] = Field(min_length=1, max_length=100)


class TeamNameIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_name: TeamName


class MemberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
