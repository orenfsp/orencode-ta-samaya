from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str
    section: str | None
    summary: str | None
    cover_file_id: UUID | None
    blocks: list[dict[str, Any]]
    hashtags: list[str]
    published_at: datetime | None
    views: int

    @field_validator("hashtags", mode="before")
    @classmethod
    def names(cls, values: list[Any]) -> list[str]:
        return [value if isinstance(value, str) else value.name for value in values]


class ArticlePage(BaseModel):
    items: list[ArticleOut]
    total: int


class TagOut(BaseModel):
    name: str
    count: int
