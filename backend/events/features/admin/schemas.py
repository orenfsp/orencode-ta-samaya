from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator, model_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20000)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class EventIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Description = ""
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    location: Location | None = None
    is_online: bool = False
    registration_url: str | None = Field(default=None, max_length=2048)

    @field_validator("registration_url")
    @classmethod
    def valid_url(cls, value: str | None) -> str | None:
        """Проверяет и нормализует ссылку регистрации; пустую строку превращает в None."""
        if not value or not value.strip():
            return None
        try:
            return str(HttpUrl(value.strip()))
        except ValueError:
            raise ValueError("Укажите ссылку http:// или https://") from None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def supported_moment(cls, value: datetime | None) -> datetime | None:
        """Проверяет, что дата попадает в диапазон 1900-2100 годов."""
        if value is not None and not 1900 <= value.year <= 2100:
            raise ValueError("Выберите дату с 1900 по 2100 год")
        return value

    @model_validator(mode="after")
    def dates(self) -> Self:
        """Проверяет, что окончание позже начала и указано место или онлайн-формат."""
        if self.ends_at <= self.starts_at:
            raise ValueError("Окончание должно быть позже начала")
        if not self.is_online and not (self.location and self.location.strip()):
            raise ValueError("Укажите место или выберите онлайн-формат")
        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    starts_at: datetime
    ends_at: datetime
    location: str | None
    is_online: bool
    registration_url: str | None
    status: Literal["draft", "published", "archived"]
    updated_at: datetime


class EventPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    description: Description | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    location: Location | None = None
    is_online: bool | None = None
    registration_url: str | None = Field(default=None, max_length=2048)

    @field_validator("registration_url")
    @classmethod
    def valid_url(cls, value: str | None) -> str | None:
        """Проверяет и нормализует ссылку регистрации так же, как EventIn."""
        return EventIn.valid_url(value)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def supported_moment(cls, value: datetime | None) -> datetime | None:
        """Проверяет диапазон даты так же, как EventIn."""
        return EventIn.supported_moment(value)

    @model_validator(mode="after")
    def nonnullable(self) -> Self:
        """Не даёт сбросить в null поля, которые не могут быть пустыми при частичном обновлении."""
        for name in ("title", "description", "starts_at", "ends_at", "is_online"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"Поле {name} не может быть пустым")
        return self


class EventPage(BaseModel):
    items: list[EventOut]
    total: int
