from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from infrastructure.enums import RankKind

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Age = Annotated[int, Field(ge=0, le=100)]
Months = Annotated[int, Field(ge=1, le=1200)]


def _empty_to_none(value: str | None) -> str | None:
    return value or None


def _required(value: object) -> object:
    if value is None:
        raise ValueError("Обязательное поле")
    return value


class DictionaryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class DictionaryAgeGroupOut(DictionaryItemOut):
    min_age: int | None
    max_age: int | None


class DictionaryRankTypeOut(DictionaryItemOut):
    rank_kind: RankKind
    min_age: int | None
    validity_months: int | None
    is_lifetime: bool
    valid_until_age: int | None


class DictionaryJudgeCategoryOut(DictionaryItemOut):
    validity_months: int | None


class DictionaryItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    description: Description | None = None

    normalize_description = field_validator("description")(_empty_to_none)


class DictionaryItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    description: Description | None = None

    normalize_description = field_validator("description")(_empty_to_none)
    require_name = field_validator("name")(_required)


class DictionaryAgeGroupCreate(DictionaryItemCreate):
    min_age: Age | None = None
    max_age: Age | None = None


class DictionaryAgeGroupUpdate(DictionaryItemUpdate):
    min_age: Age | None = None
    max_age: Age | None = None


class DictionaryRankTypeCreate(DictionaryItemCreate):
    rank_kind: RankKind
    min_age: Age | None = None
    validity_months: Months | None = None
    is_lifetime: bool = False
    valid_until_age: Age | None = None


class DictionaryRankTypeUpdate(DictionaryItemUpdate):
    rank_kind: RankKind | None = None
    min_age: Age | None = None
    validity_months: Months | None = None
    is_lifetime: bool | None = None
    valid_until_age: Age | None = None

    require_rank_fields = field_validator("rank_kind", "is_lifetime")(_required)


class DictionaryJudgeCategoryCreate(DictionaryItemCreate):
    validity_months: Months | None = None


class DictionaryJudgeCategoryUpdate(DictionaryItemUpdate):
    validity_months: Months | None = None
