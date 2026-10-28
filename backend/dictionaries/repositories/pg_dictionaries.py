from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.base import DictionaryColumns


class DictionaryRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет зависимость."""
        self._db = db

    async def list[M: DictionaryColumns](self, model: type[M], include_archived: bool) -> Sequence[M]:
        """Список записей справочника, с архивными или без."""
        statement = select(model).order_by(model.id)
        if not include_archived:
            statement = statement.where(model.is_archived.is_(False))
        return (await self._db.scalars(statement)).all()

    async def get[M: DictionaryColumns](self, model: type[M], item_id: int) -> M | None:
        """Возвращает запись справочника по id."""
        return await self._db.get(model, item_id)

    async def find_active[M: DictionaryColumns](
        self, model: type[M], name: str, exclude_id: int | None = None
    ) -> M | None:
        """Находит активную запись с таким же именем (без учёта регистра), кроме исключённой."""
        statement = select(model).where(func.lower(model.name) == name.lower(), model.is_archived.is_(False))
        if exclude_id is not None:
            statement = statement.where(model.id != exclude_id)
        return await self._db.scalar(statement.limit(1))

    async def add[M: DictionaryColumns](self, item: M) -> M:
        """Добавляет новую запись справочника."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def update[M: DictionaryColumns](self, item: M, values: dict[str, Any]) -> M:
        """Обновляет переданные поля записи справочника."""
        for field, value in values.items():
            setattr(item, field, value)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def delete(self, item: DictionaryColumns) -> bool:
        """Удаляет запись справочника; False, если она используется и удаление нарушает ссылки."""
        try:
            async with self._db.begin_nested():
                await self._db.delete(item)
                await self._db.flush()
        except IntegrityError:
            return False
        return True
