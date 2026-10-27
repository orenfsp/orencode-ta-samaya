from datetime import datetime
from typing import Annotated, Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator, model_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Section = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Summary = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20000)]
Caption = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Alt = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class HeadingBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["heading"]
    text: Title
    level: Literal[2, 3] = 2


class TextBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["text"]
    text: Text


class ImageBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["image"]
    file_id: UUID
    caption: Caption | None = None
    alt: Alt | None = None


class FileBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["file"]
    file_id: UUID
    title: Title


class LinkBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["link"]
    url: HttpUrl
    title: Title


Block = Annotated[HeadingBlock | TextBlock | ImageBlock | FileBlock | LinkBlock, Field(discriminator="type")]


def _hashtags(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        tag = value.strip().lstrip("#").lower()
        if not 2 <= len(tag) <= 50 or any(char.isspace() or char == "#" for char in tag):
            raise ValueError("Хэштег: от 2 до 50 символов без пробелов")
        if tag not in result:
            result.append(tag)
    return result


def _values(values: dict[str, Any], blocks: list[Block] | None) -> dict[str, Any]:
    if "blocks" in values:
        values["blocks"] = [block.model_dump(mode="json") for block in blocks or []]
    return values


class ArticleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    section: Section | None = None
    summary: Summary | None = None
    cover_file_id: UUID | None = None
    blocks: list[Block] = Field(default_factory=list, max_length=100)
    hashtags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("section", "summary")
    @classmethod
    def empty_as_null(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("hashtags")
    @classmethod
    def normalized(cls, values: list[str]) -> list[str]:
        return _hashtags(values)

    def values(self) -> dict[str, Any]:
        return _values(self.model_dump(), self.blocks)


class ArticlePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    section: Section | None = None
    summary: Summary | None = None
    cover_file_id: UUID | None = None
    blocks: list[Block] | None = Field(default=None, max_length=100)
    hashtags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("section", "summary")
    @classmethod
    def empty_as_null(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("hashtags")
    @classmethod
    def normalized(cls, values: list[str] | None) -> list[str] | None:
        return _hashtags(values) if values is not None else None

    @model_validator(mode="after")
    def nonnullable(self) -> Self:
        for name in ("title", "blocks", "hashtags"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"Поле {name} не может быть пустым")
        return self

    def values(self) -> dict[str, Any]:
        return _values(self.model_dump(exclude_unset=True), self.blocks)


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
    status: Literal["draft", "published", "archived"]
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    views: int

    @field_validator("hashtags", mode="before")
    @classmethod
    def names(cls, values: list[Any]) -> list[str]:
        return [value if isinstance(value, str) else value.name for value in values]


class ArticlePage(BaseModel):
    items: list[ArticleOut]
    total: int
