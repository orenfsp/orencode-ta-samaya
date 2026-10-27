from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.file import FileModel


class FileRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, file_id: UUID) -> FileModel | None:
        return await self._db.get(FileModel, file_id)

    async def get_many(self, file_ids: Sequence[UUID]) -> list[FileModel]:
        if not file_ids:
            return []
        items = await self._db.scalars(select(FileModel).where(FileModel.id.in_(file_ids)))
        found = {item.id: item for item in items}
        return [found[file_id] for file_id in file_ids if file_id in found]

    async def add(self, item: FileModel) -> FileModel:
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(self, item: FileModel, values: dict[str, Any]) -> FileModel:
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item
