from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel

J = JudgeAssignmentModel


class JudgeAssignmentRepository:
    """Доступ к назначениям судей на соревнования."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, assignment_id: UUID) -> JudgeAssignmentModel | None:
        """Возвращает назначение по id."""
        return await self._db.get(J, assignment_id)

    async def find(self, contest_id: int, judge_id: UUID) -> JudgeAssignmentModel | None:
        """Возвращает действующее назначение судьи на соревнование, если оно есть."""
        return await self._db.scalar(select(J).where(J.contest_id == contest_id, J.judge_id == judge_id, J.removed_at.is_(None)))

    async def add(self, item: JudgeAssignmentModel) -> JudgeAssignmentModel:
        """Сохраняет новое назначение."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def remove(self, item: JudgeAssignmentModel, actor_id: UUID, at: datetime) -> None:
        """Помечает назначение снятым: кто и когда снял судью; запись остаётся."""
        item.removed_at, item.removed_by = at, actor_id
        await self._db.flush()

    async def flush(self) -> None:
        """Сбрасывает накопленные изменения сессии в БД."""
        await self._db.flush()

    async def of_contest(self, contest_id: int) -> Sequence[JudgeAssignmentModel]:
        """Возвращает действующую коллегию соревнования по должности и дате назначения."""
        query = select(J).where(J.contest_id == contest_id, J.removed_at.is_(None)).order_by(J.position_id, J.created_at)
        return (await self._db.scalars(query)).all()

    async def of_judge(self, judge_id: UUID) -> Sequence[JudgeAssignmentModel]:
        """Возвращает действующие назначения судьи, новые соревнования сначала."""
        query = select(J).join(ContestModel, ContestModel.id == J.contest_id).where(J.judge_id == judge_id, J.removed_at.is_(None))
        return (await self._db.scalars(query.order_by(ContestModel.starts_on.desc()))).all()
