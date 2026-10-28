from datetime import date, datetime
from typing import Any
from urllib.parse import quote
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from core.config import settings
from infrastructure.enums import (
    CALENDAR_PLAN_TITLES,
    CalendarPlan,
    CONTEST_STATUS_TITLES,
    PARTICIPATION_TYPE_TITLES,
    ContestStatus,
    ParticipationType,
    VerificationStatus,
)


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
    verification_status: VerificationStatus = Field(exclude=True)
    rating_points: list[RatingPointOut] | None
    regulations: FileOut | None
    photos: list[FileOut] = Field(validation_alias="photo_files")
    organizer: OrganizerOut
    published_at: datetime | None

    @computed_field
    @property
    def calendar_plan_title(self) -> str:
        """Название календарного плана соревнования."""
        return CALENDAR_PLAN_TITLES[self.calendar_plan]

    @model_validator(mode="before")
    @classmethod
    def hide_unverified_points(cls, data: Any) -> Any:
        """Скрывает баллы рейтинга у неверифицированных соревнований."""
        if getattr(data, "verification_status", None) != VerificationStatus.VERIFIED:
            values = {name: getattr(data, name) for name in cls.model_fields if name not in ("rating_points", "photos")}
            return values | {"rating_points": None, "photo_files": data.photo_files}
        return data

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

    @computed_field
    @property
    def is_verified(self) -> bool:
        """Проверяет, что соревнование прошло верификацию."""
        return self.verification_status == VerificationStatus.VERIFIED


class ContestPage(BaseModel):
    items: list[ContestOut]
    total: int
