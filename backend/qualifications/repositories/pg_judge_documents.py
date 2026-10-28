from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.qualifications.judge_document import JudgeDocumentModel

D = JudgeDocumentModel


class JudgeDocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, document_id: UUID) -> JudgeDocumentModel | None:
        """Возвращает документ судьи по id или None, если такого нет."""
        return await self._db.get(D, document_id)

    async def add(self, item: JudgeDocumentModel) -> JudgeDocumentModel:
        """Добавляет документ судьи и возвращает его с обновлёнными полями."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def remove(self, item: JudgeDocumentModel) -> None:
        """Удаляет документ судьи."""
        await self._db.delete(item)
        await self._db.flush()

    async def refresh(self, item: JudgeDocumentModel) -> JudgeDocumentModel:
        """Обновляет поля документа из БД и возвращает его."""
        await self._db.refresh(item)
        return item

    async def flush(self) -> None:
        """Сбрасывает незакоммиченные изменения в БД."""
        await self._db.flush()

    async def of_contest(self, contest_id: int) -> Sequence[JudgeDocumentModel]:
        """Возвращает документы судей соревнования, отсортированные по дате создания."""
        query = select(D).where(D.contest_id == contest_id).order_by(D.created_at, D.id)
        return (await self._db.scalars(query)).all()
