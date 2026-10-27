from datetime import date, datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator, model_validator

from infrastructure.calendar_event import CalendarEventModel, local_date
from infrastructure.contest import ContestModel
from infrastructure.enums import CONTEST_STATUS_TITLES, VerificationStatus

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20000)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class EventIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Description = ""
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    location: Location | None = None
    is_online: bool = False
    registration_url: str | None = Field(default=None, max_length=2048)

    @field_validator("registration_url")
    @classmethod
    def valid_url(cls, value: str | None) -> str | None:
        if not value or not value.strip():
            return None
        try:
            return str(HttpUrl(value.strip()))
        except ValueError:
            raise ValueError("Укажите ссылку http:// или https://") from None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def supported_moment(cls, value: datetime | None) -> datetime | None:
        if value is not None and not 1900 <= value.year <= 2100:
            raise ValueError("Выберите дату с 1900 по 2100 год")
        return value

    @model_validator(mode="after")
    def dates(self) -> Self:
        if self.ends_at <= self.starts_at:
            raise ValueError("Окончание должно быть позже начала")
        if not self.is_online and not (self.location and self.location.strip()):
            raise ValueError("Укажите место или выберите онлайн-формат")
        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    starts_at: datetime
    ends_at: datetime
    location: str | None
    is_online: bool
    registration_url: str | None
    status: Literal["draft", "published", "archived"]
    updated_at: datetime


class CalendarItemOut(BaseModel):
    kind: Literal["event", "contest"]
    id: str
    contest_id: int | None
    title: str
    description: str
    start_date: date
    end_date: date | None
    starts_at: datetime | None
    ends_at: datetime | None
    location: str | None
    is_online: bool
    registration_url: str | None
    status: str
    status_title: str
    is_verified: bool
    updated_at: datetime

    @classmethod
    def from_event(cls, event: CalendarEventModel) -> Self:
        return cls(
            kind="event",
            id=str(event.id),
            contest_id=None,
            title=event.title,
            description=event.description,
            start_date=local_date(event.starts_at),
            end_date=local_date(event.ends_at),
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            location=event.location,
            is_online=event.is_online,
            registration_url=event.registration_url,
            status=event.status,
            status_title="Опубликовано",
            is_verified=False,
            updated_at=event.updated_at,
        )

    @classmethod
    def from_contest(cls, contest: ContestModel) -> Self:
        place = ", ".join(
            part for part in (contest.municipality.name if contest.municipality else None, contest.venue) if part
        )
        return cls(
            kind="contest",
            id=f"contest-{contest.id}",
            contest_id=contest.id,
            title=contest.title,
            description=contest.description or "",
            start_date=contest.starts_on,
            end_date=contest.ends_on,
            starts_at=None,
            ends_at=None,
            location=place or None,
            is_online="онлайн" in contest.contest_format.name.lower(),
            registration_url=None,
            status=contest.status.value,
            status_title=CONTEST_STATUS_TITLES[contest.status],
            is_verified=contest.verification_status == VerificationStatus.VERIFIED,
            updated_at=contest.updated_at,
        )


class EventPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    description: Description | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    location: Location | None = None
    is_online: bool | None = None
    registration_url: str | None = Field(default=None, max_length=2048)

    @field_validator("registration_url")
    @classmethod
    def valid_url(cls, value: str | None) -> str | None:
        return EventIn.valid_url(value)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def supported_moment(cls, value: datetime | None) -> datetime | None:
        return EventIn.supported_moment(value)

    @model_validator(mode="after")
    def nonnullable(self) -> Self:
        for name in ("title", "description", "starts_at", "ends_at", "is_online"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"Поле {name} не может быть пустым")
        return self


class EventPage(BaseModel):
    items: list[EventOut]
    total: int


class CalendarPage(BaseModel):
    items: list[CalendarItemOut]
    total: int
