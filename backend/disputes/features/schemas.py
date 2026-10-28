from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from infrastructure.account.user import UserModel
from infrastructure.disputes.appeal import AppealModel
from infrastructure.disputes.violation import ViolationModel
from infrastructure.enums import (
    APPEAL_STATUS_TITLES,
    SANCTION_TITLES,
    VIOLATION_STATUS_TITLES,
    AppealStatus,
    Sanction,
    ViolationStatus,
)
from infrastructure.services.file import FileModel

Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://")]


class PersonOut(BaseModel):
    id: UUID
    name: str

    @classmethod
    def of(cls, user: UserModel) -> "PersonOut":
        """Строит краткую схему человека."""
        return cls(id=user.id, name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part))


class FileOut(BaseModel):
    id: UUID
    name: str
    url: str

    @classmethod
    def of(cls, item: FileModel) -> "FileOut":
        """Строит ссылку на файл-доказательство: скачивают загрузивший и федерация."""
        return cls(id=item.id, name=item.original_name, url=f"/api/v1/files/{item.id}")


class ContestRefOut(BaseModel):
    id: int
    title: str
    ends_on: date


class AppealOut(BaseModel):
    id: UUID
    contest: ContestRefOut
    application_id: int
    entry: str
    filer: PersonOut
    current_place: int | None
    requested_place: int | None
    reason: str
    evidence_url: str | None
    files: list[FileOut]
    status: AppealStatus
    status_title: str
    decision: str | None
    decided_at: datetime | None
    created_at: datetime

    @classmethod
    def of(cls, item: AppealModel, entry: str) -> "AppealOut":
        """Строит схему апелляции."""
        contest = item.contest
        return cls(
            id=item.id, contest=ContestRefOut(id=contest.id, title=contest.title, ends_on=contest.ends_on),
            application_id=item.application_id, entry=entry, filer=PersonOut.of(item.filer),
            current_place=item.current_place, requested_place=item.requested_place, reason=item.reason,
            evidence_url=item.evidence_url, files=[FileOut.of(file) for file in item.files], status=item.status,
            status_title=APPEAL_STATUS_TITLES[item.status], decision=item.decision, decided_at=item.decided_at,
            created_at=item.created_at,
        )


class ViolationOut(BaseModel):
    id: UUID
    contest: ContestRefOut
    athlete: PersonOut
    reporter: PersonOut | None
    description: str
    evidence_url: str | None
    files: list[FileOut]
    status: ViolationStatus
    status_title: str
    sanction: Sanction | None
    sanction_title: str | None
    suspended_until: date | None
    decision: str | None
    decided_at: datetime | None
    created_at: datetime

    @classmethod
    def of(cls, item: ViolationModel, full: bool) -> "ViolationOut":
        """Строит схему нарушения; автора рапорта и доказательства видят только судьи, организатор и федерация."""
        contest = item.contest
        return cls(
            id=item.id, contest=ContestRefOut(id=contest.id, title=contest.title, ends_on=contest.ends_on),
            athlete=PersonOut.of(item.user), reporter=PersonOut.of(item.reporter) if full else None,
            description=item.description, evidence_url=item.evidence_url if full else None,
            files=[FileOut.of(file) for file in item.files] if full else [], status=item.status,
            status_title=VIOLATION_STATUS_TITLES[item.status], sanction=item.sanction,
            sanction_title=SANCTION_TITLES[item.sanction] if item.sanction else None, suspended_until=item.suspended_until,
            decision=item.decision, decided_at=item.decided_at, created_at=item.created_at,
        )


class EntryOut(BaseModel):
    application_id: int
    title: str
    place: int | None


class AppealableContestOut(BaseModel):
    id: int
    title: str
    starts_on: date
    ends_on: date


class AppealableOut(BaseModel):
    contest: AppealableContestOut
    appeal_until: date
    entries: list[EntryOut]


class AppealableList(BaseModel):
    items: list[AppealableOut]


class ParticipantOut(BaseModel):
    application_id: int
    athlete: PersonOut
    team_name: str | None


class ContestDisputesOut(BaseModel):
    privileged: bool
    can_report: bool
    appeal_until: date
    appeals: list[AppealOut]
    violations: list[ViolationOut]
    entries: list[EntryOut]
    participants: list[ParticipantOut]


class DisputeListOut(BaseModel):
    appeals: list[AppealOut]
    violations: list[ViolationOut]


class AppealIn(BaseModel):
    application_id: int = Field(ge=1)
    requested_place: int | None = Field(default=None, ge=1)
    reason: Text
    evidence_url: Url | None = None
    file_ids: list[UUID] = Field(default_factory=list, max_length=10)


class PlaceIn(BaseModel):
    application_id: int = Field(ge=1)
    place: int | None = Field(default=None, ge=1)


class AppealDecisionIn(BaseModel):
    upheld: bool
    decision: Text
    places: list[PlaceIn] = Field(default_factory=list, max_length=500)


class ViolationIn(BaseModel):
    user_id: UUID
    description: Text
    evidence_url: Url | None = None
    file_ids: list[UUID] = Field(default_factory=list, max_length=10)


class ViolationDecisionIn(BaseModel):
    sanction: Sanction | None = None
    decision: Text
    suspended_until: date | None = None
