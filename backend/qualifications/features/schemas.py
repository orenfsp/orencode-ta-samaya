from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from infrastructure.enums import (
    QUALIFICATION_KIND_TITLES,
    QUALIFICATION_STATUS_TITLES,
    QualificationKind,
    QualificationStatus,
)
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
Basis = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class PersonOut(BaseModel):
    id: UUID
    name: str
    birth_date: date

    @classmethod
    def of(cls, user: UserModel) -> "PersonOut":
        """Строит короткую схему человека из модели пользователя."""
        name = " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)
        return cls(id=user.id, name=name, birth_date=user.birth_date)


class BasisOut(BaseModel):
    result_id: int
    contest_id: int
    contest_title: str
    contest_level: str
    starts_on: date
    place: int | None
    points: int


class QualificationOut(BaseModel):
    id: UUID
    kind: QualificationKind
    kind_title: str
    item_id: int
    item_name: str
    status: QualificationStatus
    status_title: str
    user: PersonOut
    submitted_by: PersonOut
    document_file_id: UUID
    document_name: str
    basis: str | None
    reject_reason: str | None
    valid_from: date | None
    valid_until: date | None
    decided_at: datetime | None
    created_at: datetime
    basis_result: BasisOut | None = None
    order_number: str | None = None
    order_date: date | None = None
    token: str | None = None

    @classmethod
    def of(cls, item: QualificationModel) -> "QualificationOut":
        """Строит схему заявки из доменной модели."""
        return cls(
            id=item.id,
            kind=item.kind,
            kind_title=QUALIFICATION_KIND_TITLES[item.kind],
            item_id=item.item_id,
            item_name=item.item_name,
            status=item.status,
            status_title=QUALIFICATION_STATUS_TITLES[item.status],
            user=PersonOut.of(item.user),
            submitted_by=PersonOut.of(item.submitter),
            document_file_id=item.document_file_id,
            document_name=item.document.original_name,
            basis=item.basis,
            reject_reason=item.reject_reason,
            valid_from=item.valid_from,
            valid_until=item.valid_until,
            decided_at=item.decided_at,
            created_at=item.created_at,
            basis_result=BasisOut(
                result_id=item.contest_result.id,
                contest_id=item.basis_contest.id,
                contest_title=item.basis_contest.title,
                contest_level=item.basis_contest.contest_level.name,
                starts_on=item.basis_contest.starts_on,
                place=item.contest_result.place,
                points=item.contest_result.points,
            )
            if item.contest_result and item.basis_contest
            else None,
            order_number=item.order_number,
            order_date=item.order_date,
            token=item.token,
        )


class SubmitIn(BaseModel):
    kind: QualificationKind
    user_id: UUID | None = None
    item_id: int = Field(ge=1)
    document_file_id: UUID
    basis: Basis | None = None
    contest_result_id: int | None = Field(default=None, ge=1)


class ApproveIn(BaseModel):
    order_number: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    order_date: date


class VerifyOut(BaseModel):
    valid: bool
    kind_title: str
    item_name: str
    person: str
    status: str
    valid_from: date | None
    valid_until: date | None
    order_number: str | None
    order_date: date | None


class ResultChoiceOut(BaseModel):
    id: int
    contest_title: str
    starts_on: date
    place: int
    points: int


class RejectIn(BaseModel):
    reason: Reason


class MyQualifications(BaseModel):
    items: list[QualificationOut]
    submitted: list[QualificationOut]


class PreviewOut(BaseModel):
    valid_until: date | None
