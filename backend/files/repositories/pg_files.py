from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.services.file import FileModel


class FileRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет зависимость."""
        self._db = db

    async def get(self, file_id: UUID) -> FileModel | None:
        """Возвращает файл по id."""
        return await self._db.get(FileModel, file_id)

    async def get_many(self, file_ids: Sequence[UUID]) -> list[FileModel]:
        """Возвращает найденные файлы по списку id в том же порядке, пропуская отсутствующие."""
        if not file_ids:
            return []
        items = await self._db.scalars(select(FileModel).where(FileModel.id.in_(file_ids)))
        found = {item.id: item for item in items}
        return [found[file_id] for file_id in file_ids if file_id in found]

    async def add(self, item: FileModel) -> FileModel:
        """Добавляет запись о новом файле."""
        self._db.add(item)
        await self._db.flush()
        return item

    async def remove(self, item: FileModel) -> None:
        """Удаляет запись о файле."""
        await self._db.delete(item)
        await self._db.flush()

    async def update(self, item: FileModel, values: dict[str, Any]) -> FileModel:
        """Обновляет переданные поля файла."""
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item
