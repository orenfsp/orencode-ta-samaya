from datetime import date, datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from infrastructure.content.calendar_event import CalendarEventModel, local_date
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import CONTEST_STATUS_TITLES, VerificationStatus


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
    discipline: str | None = None
    groups: list[str] = []

    @classmethod
    def from_event(cls, event: CalendarEventModel) -> Self:
        """Строит пункт ленты календаря из события."""
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
        """Строит пункт ленты календаря из соревнования."""
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
            discipline=contest.discipline.name,
            groups=[group.name for group in [*contest.age_groups, *contest.academic_groups]],
        )


class CalendarPage(BaseModel):
    items: list[CalendarItemOut]
    total: int
