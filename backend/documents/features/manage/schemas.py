from datetime import date
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, Field


class FormIn(BaseModel):
    title: str = Field(min_length=1, max_length=40)
    lead: str | None = Field(default=None, max_length=200)
    text: str | None = Field(default=None, max_length=400)
    recipients: Literal["participants", "winners"] = "participants"
    places_to: int = Field(default=3, ge=1, le=100)
    signer_position: str | None = Field(default=None, max_length=200)
    signer_name: str | None = Field(default=None, max_length=100)
    issued_on: date | None = None
    judge_ids: list[UUID] | None = None
