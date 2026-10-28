from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.document import DocumentModel
from infrastructure.enums import DocumentKind
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel

D = DocumentModel


class DocumentRepository:
    """Доступ к документам и к соревнованиям, где пользователь судил."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def by_token(self, token: str) -> DocumentModel | None:
        """Возвращает документ по токену."""
        return await self._db.scalar(select(D).where(D.token == token))

    async def for_contest(self, contest_id: int, kind: DocumentKind | None = None) -> Sequence[DocumentModel]:
        """Возвращает документы соревнования, опционально отфильтрованные по виду."""
        conditions = [D.contest_id == contest_id]
        if kind is not None:
            conditions.append(D.kind == kind)
        return (await self._db.scalars(select(D).where(*conditions).order_by(D.kind, D.id))).all()

    async def replace(self, contest_id: int, kind: DocumentKind, items: Sequence[DocumentModel]) -> None:
        """Удаляет старые документы соревнования данного вида и сохраняет новые."""
        await self._db.execute(delete(D).where(D.contest_id == contest_id, D.kind == kind))
        self._db.add_all(items)
        await self._db.flush()

    async def remove(self, contest_id: int, kind: DocumentKind) -> None:
        """Удаляет документы соревнования данного вида."""
        await self._db.execute(delete(D).where(D.contest_id == contest_id, D.kind == kind))
        await self._db.flush()

    async def for_user(self, user_id: UUID) -> Sequence[DocumentModel]:
        """Возвращает все документы пользователя, новые сначала."""
        return (await self._db.scalars(select(D).where(D.user_id == user_id).order_by(D.created_at.desc(), D.id))).all()

    async def list_for_user(
        self, user_id: UUID, kind: DocumentKind | None, oldest_first: bool
    ) -> Sequence[DocumentModel]:
        """Возвращает документы пользователя по дате выдачи, опционально отфильтрованные по виду."""
        issued = D.data["form"]["issued_on"].astext
        order = (issued.asc(), D.created_at.asc(), D.id.asc()) if oldest_first else (
            issued.desc(), D.created_at.desc(), D.id.desc()
        )
        conditions = [D.user_id == user_id] + ([D.kind == kind] if kind else [])
        return (await self._db.scalars(select(D).where(*conditions).order_by(*order))).all()

    async def add(self, items: Sequence[DocumentModel]) -> None:
        """Сохраняет новые документы."""
        self._db.add_all(items)
        await self._db.flush()

    async def judged(self, user_id: UUID) -> Sequence[ContestModel]:
        """Возвращает соревнования, на которых пользователь назначен судьёй."""
        items = await self._db.scalars(
            select(ContestModel)
            .join(JudgeAssignmentModel, JudgeAssignmentModel.contest_id == ContestModel.id)
            .where(JudgeAssignmentModel.judge_id == user_id, JudgeAssignmentModel.removed_at.is_(None))
        )
        return items.all()

    async def flush(self) -> None:
        """Сбрасывает накопленные изменения сессии в БД."""
        await self._db.flush()
