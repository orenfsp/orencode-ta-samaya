from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.dictionaries.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.participation.document import DocumentModel
from infrastructure.enums import ApplicationStatus
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel


class ReadinessRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def contest(self, contest_id: int) -> ContestModel | None:
        """Возвращает соревнование по id или None."""
        return await self._db.get(ContestModel, contest_id)

    async def positions(self, contest_id: int) -> set[str]:
        """Возвращает названия должностей судей в действующей коллегии соревнования."""
        rows = await self._db.scalars(
            select(DictionaryJudgePositionModel.name)
            .join(JudgeAssignmentModel, JudgeAssignmentModel.position_id == DictionaryJudgePositionModel.id)
            .where(JudgeAssignmentModel.contest_id == contest_id, JudgeAssignmentModel.removed_at.is_(None))
        )
        return set(rows.all())

    async def applications(self, contest_id: int, status: ApplicationStatus) -> int:
        """Считает заявки соревнования в статусе."""
        query = select(func.count()).select_from(ContestApplicationModel).where(
            ContestApplicationModel.contest_id == contest_id, ContestApplicationModel.status == status
        )
        return await self._db.scalar(query) or 0

    async def results(self, contest_id: int) -> int:
        """Считает внесённые места соревнования."""
        query = select(func.count()).select_from(ContestResultModel).where(ContestResultModel.contest_id == contest_id)
        return await self._db.scalar(query) or 0

    async def documents(self, contest_id: int) -> int:
        """Считает выпущенные документы соревнования."""
        query = select(func.count()).select_from(DocumentModel).where(DocumentModel.contest_id == contest_id)
        return await self._db.scalar(query) or 0
