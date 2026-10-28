from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, StringConstraints

from infrastructure.enums import ConsentStatus


class PersonOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    birth_date: date


class FileOut(BaseModel):
    id: UUID
    original_name: str
    url: str


class ConsentRowOut(BaseModel):
    id: UUID
    person: PersonOut
    guardian_name: str
    guardian_phone: str
    file: FileOut
    status: ConsentStatus
    status_title: str
    reject_reason: str | None
    submitted_at: datetime
    decided_at: datetime | None


class ConsentPage(BaseModel):
    items: list[ConsentRowOut]
    total: int


class RejectIn(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class CountOut(BaseModel):
    pending: int
