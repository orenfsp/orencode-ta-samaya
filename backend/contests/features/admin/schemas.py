from datetime import date, datetime
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, computed_field, field_validator

from core.config import settings
from infrastructure.enums import (
    CALENDAR_PLAN_TITLES,
    CalendarPlan,
    CONTEST_STATUS_TITLES,
    PARTICIPATION_TYPE_TITLES,
    VERIFICATION_STATUS_TITLES,
    ContestStatus,
    ParticipationType,
    VerificationStatus,
)

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=10000)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
RefId = Annotated[int, Field(ge=1)]
TeamSize = Annotated[int, Field(ge=1, le=100)]
Amount = Annotated[int, Field(ge=0)]
PlanNumber = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


def _empty_to_none(value: str | None) -> str | None:
    """Превращает пустую строку в None."""
    return value or None


def _required(value: object) -> object:
    """Проверяет, что значение не None, иначе бросает ошибку валидации."""
    if value is None:
        raise ValueError("Обязательное поле")
    return value


class ContestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: LongText | None = None
    discipline_id: RefId
    contest_type_id: RefId
    contest_level_id: RefId
    contest_format_id: RefId
    participation_type: ParticipationType
    team_size_min: TeamSize | None = None
    team_size_max: TeamSize | None = None
    municipality_id: RefId | None = None
    venue: ShortText | None = None
    age_group_ids: list[RefId] = Field(default_factory=list, max_length=20)
    academic_group_ids: list[RefId] = Field(default_factory=list, max_length=20)
    starts_on: date
    ends_on: date
    registration_opens_at: AwareDatetime
    registration_closes_at: AwareDatetime
    prize_fund_text: ShortText | None = None
    prize_fund_amount: Amount | None = None
    calendar_plan: CalendarPlan = CalendarPlan.NONE
    calendar_plan_number: PlanNumber | None = None
    regulations_file_id: UUID | None = None
    photo_file_ids: list[UUID] = Field(default_factory=list)

    normalize_texts = field_validator("description", "venue", "prize_fund_text")(_empty_to_none)


class ContestPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    description: LongText | None = None
    discipline_id: RefId | None = None
    contest_type_id: RefId | None = None
    contest_level_id: RefId | None = None
    contest_format_id: RefId | None = None
    participation_type: ParticipationType | None = None
    team_size_min: TeamSize | None = None
    team_size_max: TeamSize | None = None
    municipality_id: RefId | None = None
    venue: ShortText | None = None
    age_group_ids: list[RefId] | None = Field(default=None, max_length=20)
    academic_group_ids: list[RefId] | None = Field(default=None, max_length=20)
    starts_on: date | None = None
    ends_on: date | None = None
    registration_opens_at: AwareDatetime | None = None
    registration_closes_at: AwareDatetime | None = None
    prize_fund_text: ShortText | None = None
    prize_fund_amount: Amount | None = None
    calendar_plan: CalendarPlan | None = None
    calendar_plan_number: PlanNumber | None = None
    regulations_file_id: UUID | None = None
    photo_file_ids: list[UUID] | None = None

    normalize_texts = field_validator("description", "venue", "prize_fund_text")(_empty_to_none)
    require_values = field_validator(
        "photo_file_ids",
        "title",
        "discipline_id",
        "contest_type_id",
        "contest_level_id",
        "contest_format_id",
        "participation_type",
        "age_group_ids",
        "academic_group_ids",
        "starts_on",
        "ends_on",
        "registration_opens_at",
        "registration_closes_at",
    )(_required)


class CancelIn(BaseModel):
    reason: Reason


class RefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class OrganizerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    last_name: str
    first_name: str
    middle_name: str | None

    @computed_field
    @property
    def full_name(self) -> str:
        """Собирает фамилию, имя и отчество организатора в одну строку."""
        return " ".join(part for part in (self.last_name, self.first_name, self.middle_name) if part)


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
        """Возвращает публичную ссылку на файл в S3 или путь к приватной раздаче через API."""
        if self.is_public:
            return f"{settings.s3_public_url}/{settings.s3_public_bucket}/{quote(self.object_key)}"
        return f"/api/v1/files/{self.id}"


class RatingPointOut(BaseModel):
    place: int
    points: int


class ContestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    discipline: RefOut
    contest_type: RefOut
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
    calendar_plan: CalendarPlan
    calendar_plan_number: str | None
    status: ContestStatus
    cancel_reason: str | None
    verification_status: VerificationStatus
    verification_reason: str | None
    verification_requested_at: datetime | None
    verified_at: datetime | None
    rating_points: list[RatingPointOut] | None
    regulations: FileOut | None
    photos: list[FileOut] = Field(validation_alias="photo_files")
    organizer: OrganizerOut
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def status_title(self) -> str:
        """Возвращает человекочитаемое название статуса соревнования."""
        return CONTEST_STATUS_TITLES[self.status]

    @computed_field
    @property
    def calendar_plan_title(self) -> str:
        """Название календарного плана соревнования."""
        return CALENDAR_PLAN_TITLES[self.calendar_plan]

    @computed_field
    @property
    def participation_type_title(self) -> str:
        """Возвращает человекочитаемое название типа участия."""
        return PARTICIPATION_TYPE_TITLES[self.participation_type]

    @computed_field
    @property
    def verification_title(self) -> str:
        """Возвращает человекочитаемое название статуса верификации."""
        return VERIFICATION_STATUS_TITLES[self.verification_status]

    @computed_field
    @property
    def is_verified(self) -> bool:
        """Проверяет, что соревнование прошло верификацию."""
        return self.verification_status == VerificationStatus.VERIFIED


class ContestPage(BaseModel):
    items: list[ContestOut]
    total: int


class RatingPointIn(BaseModel):
    place: Annotated[int, Field(ge=1, le=100)]
    points: Annotated[int, Field(ge=0, le=100000)]


RatingPoints = Annotated[list[RatingPointIn], Field(max_length=100)]


class AdminContestIn(ContestIn):
    organizer_id: UUID | None = None
    rating_points: RatingPoints | None = None


class AdminContestPatch(ContestPatch):
    organizer_id: UUID | None = None

    require_organizer = field_validator("organizer_id")(_required)


class VerifyIn(BaseModel):
    rating_points: RatingPoints | None = None


class RatingPointsIn(BaseModel):
    rating_points: RatingPoints


class ReasonIn(BaseModel):
    reason: Reason


class LevelPointsOut(BaseModel):
    level: RefOut
    rating_points: list[RatingPointOut]
