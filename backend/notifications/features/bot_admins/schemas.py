from datetime import datetime
from uuid import UUID

from typing import Annotated

from pydantic import BaseModel, StringConstraints

from infrastructure.enums import BotAdminLevel

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=255,
                                         pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]


class LevelOut(BaseModel):
    code: BotAdminLevel
    label: str
    rights: list[str]


class BotAdminOut(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    level: BotAdminLevel
    linked: bool
    granted_by: str | None
    created_at: datetime


class BotAdminsOut(BaseModel):
    my_level: BotAdminLevel | None
    can_manage: bool
    levels: list[LevelOut]
    items: list[BotAdminOut]


class GrantIn(BaseModel):
    email: Email
    level: BotAdminLevel


class LevelIn(BaseModel):
    level: BotAdminLevel
