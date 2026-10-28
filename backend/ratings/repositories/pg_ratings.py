from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.user import UserModel
from infrastructure.contests.contest import ContestModel
from infrastructure.disputes.violation import ViolationModel
from infrastructure.enums import ApplicationStatus, ContestStatus, QualificationKind, QualificationStatus, Sanction, VerificationStatus, ViolationStatus
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.participation.rating_setting import RatingSettingModel
from infrastructure.qualifications.qualification import QualificationModel

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

    async def settings(self) -> RatingSettingModel | None:
        """Возвращает правила рейтинга федерации или None, если их ещё не меняли."""
        return await self._db.get(RatingSettingModel, 1)

    def add_settings(self, item: RatingSettingModel) -> None:
        """Добавляет строку правил рейтинга."""
        self._db.add(item)

    async def ranks(self, user_ids: Sequence[UUID], on: date) -> dict[UUID, int]:
        """Возвращает действующие на дату разряды людей: человек → id разряда в справочнике."""
        if not user_ids:
            return {}
        Q = QualificationModel
        rows = await self._db.execute(
            select(Q.user_id, Q.rank_type_id).where(
                Q.user_id.in_(user_ids), Q.kind == QualificationKind.RANK, Q.status == QualificationStatus.APPROVED,
                Q.rank_type_id.is_not(None), or_(Q.valid_until.is_(None), Q.valid_until >= on),
            )
        )
        return {user_id: rank_id for user_id, rank_id in rows.tuples() if rank_id is not None}

    async def season_results(self, user_id: UUID, since: date) -> Sequence[tuple[str, VerificationStatus, int | None]]:
        """Возвращает места человека за сезон на любых соревнованиях: название, верификация, место."""
        rows = await self._db.execute(
            select(C.title, C.verification_status, R.place)
            .join(A, A.id == R.application_id)
            .join(C, C.id == R.contest_id)
            .where(R.user_id == user_id, A.status == ApplicationStatus.APPROVED, C.ends_on >= since)
            .order_by(C.ends_on.desc())
        )
        return rows.tuples().all()

    async def awaiting(self, user_id: UUID, since: date) -> Sequence[str]:
        """Возвращает названия прошедших и идущих соревнований сезона, где у человека одобренная заявка, а места нет."""
        M = ContestApplicationMemberModel
        rows = await self._db.scalars(
            select(C.title)
            .join(A, A.contest_id == C.id)
            .join(M, and_(M.application_id == A.id, M.user_id == user_id, M.is_active))
            .outerjoin(R, and_(R.contest_id == C.id, R.user_id == user_id))
            .where(
                A.status == ApplicationStatus.APPROVED, R.id.is_(None), C.ends_on >= since,
                C.status.in_((ContestStatus.IN_PROGRESS, ContestStatus.COMPLETED)),
            )
            .order_by(C.ends_on.desc())
        )
        return rows.all()

    async def suspended(self, on: date) -> dict[UUID, date]:
        """Возвращает отстранённых на дату: человек → последний день отстранения."""
        V = ViolationModel
        rows = await self._db.execute(
            select(V.user_id, V.suspended_until).where(
                V.status == ViolationStatus.DECIDED, V.sanction == Sanction.SUSPENSION, V.suspended_until >= on,
            )
        )
        result: dict[UUID, date] = {}
        for user_id, until in rows.tuples():
            if until is not None and (user_id not in result or until > result[user_id]):
                result[user_id] = until
        return result
