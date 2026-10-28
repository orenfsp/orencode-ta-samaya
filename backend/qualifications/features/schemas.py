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
        )


class SubmitIn(BaseModel):
    kind: QualificationKind
    user_id: UUID | None = None
    item_id: int = Field(ge=1)
    document_file_id: UUID
    basis: Basis | None = None


class RejectIn(BaseModel):
    reason: Reason


class MyQualifications(BaseModel):
    items: list[QualificationOut]
    submitted: list[QualificationOut]


class PreviewOut(BaseModel):
    valid_until: date | None
