from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from infrastructure.enums import DocumentKind


class ContestRefOut(BaseModel):
    id: int
    title: str
    dates: str


class MyDocumentOut(BaseModel):
    token: str
    number: str
    kind: DocumentKind
    kind_title: str
    title: str
    role: Literal["athlete", "coach", "judge", "organizer"]
    place: int | None
    issued_on: date
    contest: ContestRefOut


class AvailableOut(BaseModel):
    contest: ContestRefOut


class MyDocuments(BaseModel):
    items: list[MyDocumentOut]
    available: list[AvailableOut]


class ReferenceIn(BaseModel):
    contest_id: int = Field(ge=1)
