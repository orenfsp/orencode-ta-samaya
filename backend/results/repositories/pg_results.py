from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.enums import ApplicationStatus
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.judge_document import JudgeDocumentModel

R = ContestResultModel
A = ContestApplicationModel


class ResultRepository:
    """Доступ к результатам соревнований в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def list(self, contest_id: int) -> Sequence[ContestResultModel]:
        """Возвращает результаты одобренных заявок соревнования, отсортированные по месту."""
        items = await self._db.scalars(
            select(R)
            .join(A, A.id == R.application_id)
            .where(R.contest_id == contest_id, A.status == ApplicationStatus.APPROVED)
            .order_by(R.place.asc().nulls_last(), R.application_id, R.id)
        )
        return items.all()

    async def judges(self, contest_id: int) -> Sequence[JudgeAssignmentModel]:
        """Возвращает судейские назначения соревнования, отсортированные по должности."""
        items = await self._db.scalars(
            select(JudgeAssignmentModel)
            .where(JudgeAssignmentModel.contest_id == contest_id, JudgeAssignmentModel.removed_at.is_(None))
            .order_by(JudgeAssignmentModel.position_id, JudgeAssignmentModel.created_at)
        )
        return items.all()

    async def judge_documents(self, contest_id: int) -> Sequence[JudgeDocumentModel]:
        """Возвращает документы судей соревнования, отсортированные по дате создания."""
        items = await self._db.scalars(
            select(JudgeDocumentModel)
            .where(JudgeDocumentModel.contest_id == contest_id)
            .order_by(JudgeDocumentModel.created_at, JudgeDocumentModel.id)
        )
        return items.all()

    async def replace(self, contest_id: int, items: Sequence[ContestResultModel]) -> None:
        """Удаляет старые результаты соревнования и записывает новые."""
        await self._db.execute(delete(R).where(R.contest_id == contest_id))
        self._db.add_all(items)
        await self._db.flush()
