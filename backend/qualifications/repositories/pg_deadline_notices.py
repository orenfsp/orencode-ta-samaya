from uuid import UUID

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.qualifications.deadline_notice import DeadlineNoticeModel


class DeadlineNoticeRepository:
    """Отмечает отправленные напоминания об истекающих сроках, чтобы не слать их повторно."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def claim(self, qualification_id: UUID, threshold_days: int) -> bool:
        """Отмечает напоминание о сроке отправленным; False, если такое уже было."""
        query = (insert(DeadlineNoticeModel).values(qualification_id=qualification_id, threshold_days=threshold_days)
                 .on_conflict_do_nothing(constraint="uq_deadline_notices_threshold").returning(DeadlineNoticeModel.id))
        return (await self._db.execute(query)).scalar_one_or_none() is not None
