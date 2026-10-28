from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.enums import ApplicationStatus, VerificationStatus
from infrastructure.account.user import UserModel

R = ContestResultModel
A = ContestApplicationModel
C = ContestModel


class RatingRepository:
    """Доступ к результатам соревнований для подсчёта рейтинга в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def scores(
        self, since: date, discipline_id: int | None = None, user_id: UUID | None = None
    ) -> Sequence[tuple[UUID, int, int, str, date, int | None, int]]:
        """Возвращает результаты верифицированных соревнований за окно рейтинга по пользователю или дисциплине."""
        conditions = [
            A.status == ApplicationStatus.APPROVED,
            C.verification_status == VerificationStatus.VERIFIED,
            C.ends_on >= since,
        ]
        if discipline_id is not None:
            conditions.append(C.discipline_id == discipline_id)
        if user_id is not None:
            conditions.append(R.user_id == user_id)
        rows = await self._db.execute(
            select(R.user_id, C.discipline_id, C.id, C.title, C.ends_on, R.place, R.points)
            .join(A, A.id == R.application_id)
            .join(C, C.id == R.contest_id)
            .where(*conditions)
            .order_by(C.ends_on.desc(), C.id)
        )
        return rows.tuples().all()

    async def users(self, user_ids: Sequence[UUID]) -> dict[UUID, UserModel]:
        """Возвращает активных пользователей по id в виде словаря id -> модель."""
        if not user_ids:
            return {}
        items = await self._db.scalars(
            select(UserModel).where(UserModel.id.in_(user_ids), UserModel.is_active.is_(True))
        )
        return {item.id: item for item in items.all()}
