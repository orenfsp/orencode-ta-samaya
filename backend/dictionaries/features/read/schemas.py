from datetime import datetime

from pydantic import BaseModel, ConfigDict

from infrastructure.enums import RankKind


class DictionaryInfoOut(BaseModel):
    key: str
    title: str


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
