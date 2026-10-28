from datetime import date
from typing import Literal

from pydantic import BaseModel

from infrastructure.enums import DocumentKind


class FormOut(BaseModel):
    title: str
    lead: str | None
    text: str | None
    recipients: Literal["participants", "winners"]
    places_to: int
    signer_position: str | None
    signer_name: str | None
    issued_on: date


class ItemOut(BaseModel):
    token: str
    number: str
    name: str
    role: Literal["athlete", "coach", "judge", "organizer"]
    team: str | None
    place: int | None


class GroupOut(BaseModel):
    kind: DocumentKind
    kind_title: str
    form: FormOut
    items: list[ItemOut]


class GroupList(BaseModel):
    items: list[GroupOut]


class ContestRefOut(BaseModel):
    id: int
    title: str
    discipline: str
    dates: str
    place: str | None
    organizer: str


class PanelLineOut(BaseModel):
    name: str
    position: str
    category: str | None
    valid_until: date | None


class DocumentOut(BaseModel):
    valid: bool
    token: str
    number: str
    kind: DocumentKind
    kind_title: str
    title: str
    lead: str | None
    text: str | None
    issued_on: date
    signer_position: str | None
    signer_name: str | None
    recipient: str
    role: Literal["athlete", "coach", "judge", "organizer"]
    team: str | None
    place: int | None
    athletes: list[str]
    position: str | None
    panel: list[PanelLineOut] = []
    contest: ContestRefOut
