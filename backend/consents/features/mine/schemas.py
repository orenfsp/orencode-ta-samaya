from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from infrastructure.enums import ConsentStatus

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class FileOut(BaseModel):
    id: UUID
    original_name: str
    url: str


class ConsentOut(BaseModel):
    id: UUID
    guardian_name: str
    guardian_phone: str
    file: FileOut
    status: ConsentStatus
    status_title: str
    reject_reason: str | None
    submitted_at: datetime
    decided_at: datetime | None


class MyConsentOut(BaseModel):
    required: bool
    consent: ConsentOut | None


class ConsentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    guardian_name: Annotated[Text, StringConstraints(max_length=300)]
    guardian_phone: Annotated[Text, StringConstraints(max_length=40, pattern=r"^[0-9+()\- ]{5,40}$")]
    file_id: UUID
