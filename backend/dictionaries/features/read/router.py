from typing import Any

from fastapi import APIRouter

from dictionaries.dependencies import DictionaryDep
from dictionaries.domain.dictionaries import Dictionary
from dictionaries.features.read.schemas import (
    DictionaryAgeGroupOut,
    DictionaryInfoOut,
    DictionaryItemOut,
    DictionaryJudgeCategoryOut,
    DictionaryRankTypeOut,
)

router = APIRouter(prefix="/dictionaries", tags=["Справочники"])

OUT_SCHEMAS: dict[str, type[DictionaryItemOut]] = {
    "age_groups": DictionaryAgeGroupOut,
    "rank_types": DictionaryRankTypeOut,
    "judge_categories": DictionaryJudgeCategoryOut,
}


@router.get("", summary="Список справочников")
async def catalog() -> list[DictionaryInfoOut]:
    return [DictionaryInfoOut(key=key, title=title) for key, title in Dictionary.catalog()]


def _add_list_route(key: str, title: str) -> None:
    out = OUT_SCHEMAS.get(key, DictionaryItemOut)

    async def list_items(dictionary: DictionaryDep) -> Any:
        return [out.model_validate(item) for item in await dictionary.list(key, include_archived=False)]

    router.add_api_route(
        f"/{key}",
        list_items,
        methods=["GET"],
        response_model=list[out],
        summary=title,
        name=f"read_{key}",
    )


for _key, _title in Dictionary.catalog():
    _add_list_route(_key, _title)
