from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Path, Query, status

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from dictionaries.dependencies import DictionaryDep
from dictionaries.domain.dictionaries import Dictionary
from dictionaries.features.manage.schemas import (
    DictionaryAgeGroupCreate,
    DictionaryAgeGroupOut,
    DictionaryAgeGroupUpdate,
    DictionaryItemCreate,
    DictionaryItemOut,
    DictionaryItemUpdate,
    DictionaryJudgeCategoryCreate,
    DictionaryJudgeCategoryOut,
    DictionaryJudgeCategoryUpdate,
    DictionaryRankTypeCreate,
    DictionaryRankTypeOut,
    DictionaryRankTypeUpdate,
)
from infrastructure.enums import Role

router = APIRouter(prefix="/admin/dictionaries")

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
ItemId = Annotated[int, Path()]

OUT_SCHEMAS: dict[str, type[DictionaryItemOut]] = {
    "age_groups": DictionaryAgeGroupOut,
    "rank_types": DictionaryRankTypeOut,
    "judge_categories": DictionaryJudgeCategoryOut,
}


def _add_common_routes(key: str, title: str) -> None:
    """Регистрирует для справочника общие маршруты: список, удаление, архивацию и восстановление."""
    out = OUT_SCHEMAS.get(key, DictionaryItemOut)
    tag = f"Справочники (федерация): {title}"

    async def list_items(
        user: Federation,
        dictionary: DictionaryDep,
        include_archived: Annotated[bool, Query()] = False,
    ) -> Any:
        """Список записей справочника."""
        return [out.model_validate(item) for item in await dictionary.list(key, include_archived)]

    async def delete_item(item_id: ItemId, user: Federation, ip: ClientIp, dictionary: DictionaryDep) -> None:
        """Удаляет запись справочника."""
        await dictionary.delete(key, item_id, user.id, ip)

    async def archive_item(item_id: ItemId, user: Federation, ip: ClientIp, dictionary: DictionaryDep) -> Any:
        """Архивирует запись справочника."""
        return out.model_validate(await dictionary.archive(key, item_id, user.id, ip))

    async def restore_item(item_id: ItemId, user: Federation, ip: ClientIp, dictionary: DictionaryDep) -> Any:
        """Восстанавливает запись справочника из архива."""
        return out.model_validate(await dictionary.restore(key, item_id, user.id, ip))

    router.add_api_route(
        f"/{key}", list_items, methods=["GET"], response_model=list[out], tags=[tag], name=f"list_{key}"
    )
    router.add_api_route(
        f"/{key}/{{item_id}}",
        delete_item,
        methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT,
        tags=[tag],
        name=f"delete_{key}",
    )
    router.add_api_route(
        f"/{key}/{{item_id}}/archive",
        archive_item,
        methods=["POST"],
        response_model=out,
        tags=[tag],
        name=f"archive_{key}",
    )
    router.add_api_route(
        f"/{key}/{{item_id}}/restore",
        restore_item,
        methods=["POST"],
        response_model=out,
        tags=[tag],
        name=f"restore_{key}",
    )


def _register(key: str, tag: str, create: Any, update: Any, out: type[DictionaryItemOut]) -> None:
    """Регистрирует маршруты создания и обновления записи справочника."""
    router.add_api_route(
        f"/{key}",
        create,
        methods=["POST"],
        status_code=status.HTTP_201_CREATED,
        response_model=out,
        tags=[tag],
        name=f"create_{key}",
    )
    router.add_api_route(
        f"/{key}/{{item_id}}", update, methods=["PATCH"], response_model=out, tags=[tag], name=f"update_{key}"
    )


def _add_simple_routes(key: str, title: str) -> None:
    """Регистрирует создание и обновление для простого справочника без дополнительных полей."""

    async def create_item(
        body: Annotated[DictionaryItemCreate, Body()], user: Federation, ip: ClientIp, dictionary: DictionaryDep
    ) -> Any:
        """Создаёт запись справочника."""
        return DictionaryItemOut.model_validate(await dictionary.create(key, body.model_dump(), user.id, ip))

    async def update_item(
        item_id: ItemId,
        body: Annotated[DictionaryItemUpdate, Body()],
        user: Federation,
        ip: ClientIp,
        dictionary: DictionaryDep,
    ) -> Any:
        """Обновляет запись справочника."""
        fields = body.model_dump(exclude_unset=True)
        return DictionaryItemOut.model_validate(await dictionary.update(key, item_id, fields, user.id, ip))

    _register(key, f"Справочники (федерация): {title}", create_item, update_item, DictionaryItemOut)


def _add_age_group_routes(key: str, title: str) -> None:
    """Регистрирует создание и обновление для справочника возрастных групп."""

    async def create_item(
        body: Annotated[DictionaryAgeGroupCreate, Body()], user: Federation, ip: ClientIp, dictionary: DictionaryDep
    ) -> Any:
        """Создаёт возрастную группу."""
        return DictionaryAgeGroupOut.model_validate(await dictionary.create(key, body.model_dump(), user.id, ip))

    async def update_item(
        item_id: ItemId,
        body: Annotated[DictionaryAgeGroupUpdate, Body()],
        user: Federation,
        ip: ClientIp,
        dictionary: DictionaryDep,
    ) -> Any:
        """Обновляет возрастную группу."""
        fields = body.model_dump(exclude_unset=True)
        return DictionaryAgeGroupOut.model_validate(await dictionary.update(key, item_id, fields, user.id, ip))

    _register(key, f"Справочники (федерация): {title}", create_item, update_item, DictionaryAgeGroupOut)


def _add_rank_type_routes(key: str, title: str) -> None:
    """Регистрирует создание и обновление для справочника разрядов и званий."""

    async def create_item(
        body: Annotated[DictionaryRankTypeCreate, Body()], user: Federation, ip: ClientIp, dictionary: DictionaryDep
    ) -> Any:
        """Создаёт разряд или звание."""
        return DictionaryRankTypeOut.model_validate(await dictionary.create(key, body.model_dump(), user.id, ip))

    async def update_item(
        item_id: ItemId,
        body: Annotated[DictionaryRankTypeUpdate, Body()],
        user: Federation,
        ip: ClientIp,
        dictionary: DictionaryDep,
    ) -> Any:
        """Обновляет разряд или звание."""
        fields = body.model_dump(exclude_unset=True)
        return DictionaryRankTypeOut.model_validate(await dictionary.update(key, item_id, fields, user.id, ip))

    _register(key, f"Справочники (федерация): {title}", create_item, update_item, DictionaryRankTypeOut)


def _add_judge_category_routes(key: str, title: str) -> None:
    """Регистрирует создание и обновление для справочника судейских категорий."""

    async def create_item(
        body: Annotated[DictionaryJudgeCategoryCreate, Body()], user: Federation, ip: ClientIp, dictionary: DictionaryDep
    ) -> Any:
        """Создаёт судейскую категорию."""
        return DictionaryJudgeCategoryOut.model_validate(await dictionary.create(key, body.model_dump(), user.id, ip))

    async def update_item(
        item_id: ItemId,
        body: Annotated[DictionaryJudgeCategoryUpdate, Body()],
        user: Federation,
        ip: ClientIp,
        dictionary: DictionaryDep,
    ) -> Any:
        """Обновляет судейскую категорию."""
        fields = body.model_dump(exclude_unset=True)
        return DictionaryJudgeCategoryOut.model_validate(await dictionary.update(key, item_id, fields, user.id, ip))

    _register(key, f"Справочники (федерация): {title}", create_item, update_item, DictionaryJudgeCategoryOut)


BODY_ROUTES = {
    "age_groups": _add_age_group_routes,
    "rank_types": _add_rank_type_routes,
    "judge_categories": _add_judge_category_routes,
}

for _key, _title in Dictionary.catalog():
    _add_common_routes(_key, _title)
    BODY_ROUTES.get(_key, _add_simple_routes)(_key, _title)
