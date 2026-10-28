from datetime import datetime

from pydantic import BaseModel, Field

from infrastructure.enums import Channel
from notifications.domain.types import NotificationGroup


class PreferenceOut(BaseModel):
    group: NotificationGroup
    label: str
    description: str
    email: bool
    telegram: bool
    locked: bool


class PreferencesOut(BaseModel):
    items: list[PreferenceOut]


class PreferenceIn(BaseModel):
    group: NotificationGroup
    channel: Channel
    enabled: bool


class PreferencesIn(BaseModel):
    items: list[PreferenceIn] = Field(max_length=20)


class TelegramOut(BaseModel):
    available: bool
    bot: str
    linked: bool
    username: str | None
    linked_at: datetime | None
    mailpit_url: str | None


class TelegramLinkOut(BaseModel):
    url: str
