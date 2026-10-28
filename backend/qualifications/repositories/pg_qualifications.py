from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus, CoachLinkStatus, QualificationKind, QualificationStatus, Role, RoleStatus
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.sport.coach_link import CoachLinkModel

Q = QualificationModel
S = QualificationStatus


class QualificationRepository:
    """Доступ к заявкам на разряды и судейские категории."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, qualification_id: UUID) -> QualificationModel | None:
        """Возвращает заявку по id."""
        return await self._db.get(Q, qualification_id)

    async def add(self, item: QualificationModel) -> QualificationModel:
        """Сохраняет новую заявку."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def by_token(self, token: str) -> QualificationModel | None:
        """Возвращает квалификацию по токену QR-проверки или None."""
        return await self._db.scalar(select(Q).where(Q.token == token))

    async def own_result(self, result_id: int, user_id: UUID) -> bool:
        """Проверяет, что место в протоколе принадлежит человеку."""
        query = (
            select(ContestResultModel.id)
            .join(ContestApplicationModel, ContestApplicationModel.id == ContestResultModel.application_id)
            .where(ContestResultModel.id == result_id, ContestResultModel.user_id == user_id,
                   ContestResultModel.place.is_not(None), ContestApplicationModel.status == ApplicationStatus.APPROVED)
        )
        return await self._db.scalar(query) is not None

    async def results(self, user_id: UUID) -> Sequence[ContestResultModel]:
        """Возвращает места человека в протоколах, новые первыми."""
        query = (
            select(ContestResultModel)
            .join(ContestApplicationModel, ContestApplicationModel.id == ContestResultModel.application_id)
            .where(ContestResultModel.user_id == user_id, ContestResultModel.place.is_not(None),
                   ContestApplicationModel.status == ApplicationStatus.APPROVED)
            .order_by(ContestResultModel.created_at.desc())
        )
        return (await self._db.scalars(query)).all()

    async def contests(self, ids: Sequence[int]) -> dict[int, ContestModel]:
        """Возвращает соревнования по id: id → соревнование."""
        if not ids:
            return {}
        items = await self._db.scalars(select(ContestModel).where(ContestModel.id.in_(set(ids))))
        return {item.id: item for item in items.all()}

    async def flush(self) -> None:
        """Сбрасывает накопленные изменения сессии в БД."""
        await self._db.flush()

    async def of_user(self, user_id: UUID, kind: QualificationKind, status: QualificationStatus) -> QualificationModel | None:
        """Возвращает заявку пользователя данного вида и статуса, если она есть."""
        return await self._db.scalar(select(Q).where(Q.user_id == user_id, Q.kind == kind, Q.status == status))

    async def history(self, user_ids: Sequence[UUID]) -> Sequence[QualificationModel]:
        """Возвращает все заявки указанных пользователей, новые сначала."""
        return (await self._db.scalars(select(Q).where(Q.user_id.in_(user_ids)).order_by(Q.created_at.desc()))).all()

    async def submitted_by(self, user_id: UUID) -> Sequence[QualificationModel]:
        """Возвращает заявки, поданные пользователем за других (тренером за спортсменов)."""
        query = select(Q).where(Q.submitted_by == user_id, Q.user_id != user_id).order_by(Q.created_at.desc())
        return (await self._db.scalars(query)).all()

    async def queue(self, kind: QualificationKind | None, status: QualificationStatus | None) -> Sequence[QualificationModel]:
        """Возвращает заявки, отфильтрованные по виду и статусу, не больше 500 штук."""
        conditions = []
        if kind is not None:
            conditions.append(Q.kind == kind)
        if status is not None:
            conditions.append(Q.status == status)
        order = Q.created_at.asc() if status == S.PENDING else Q.created_at.desc()
        return (await self._db.scalars(select(Q).where(*conditions).order_by(order).limit(500))).all()

    async def valid_on(self, user_ids: Sequence[UUID], kind: QualificationKind, on: date) -> dict[UUID, QualificationModel]:
        """Возвращает действующий на дату on разряд или категорию каждого пользователя из списка."""
        query = select(Q).where(
            Q.user_id.in_(user_ids), Q.kind == kind, Q.status.in_((S.APPROVED, S.SUPERSEDED)),
            Q.valid_from <= on, or_(Q.valid_until.is_(None), Q.valid_until >= on),
        ).order_by(Q.valid_from.desc())
        found: dict[UUID, QualificationModel] = {}
        for item in (await self._db.scalars(query)).all():
            found.setdefault(item.user_id, item)
        return found

    async def active_coaches(self, athlete_id: UUID) -> list[UUID]:
        """Возвращает id тренеров с активной связью со спортсменом."""
        rows = await self._db.scalars(
            select(CoachLinkModel.coach_id)
            .where(CoachLinkModel.athlete_id == athlete_id, CoachLinkModel.status == CoachLinkStatus.ACTIVE)
            .distinct()
        )
        return list(rows.all())

    async def expiring(self, until: date) -> Sequence[QualificationModel]:
        """Возвращает действующие разряды и категории, истекающие не позднее until."""
        query = select(Q).where(Q.status == S.APPROVED, Q.valid_until.is_not(None), Q.valid_until <= until)
        return (await self._db.scalars(query)).all()

    async def coach_athletes(self, coach_id: UUID) -> Sequence[UserModel]:
        """Возвращает активных спортсменов из заявок, созданных тренером."""
        A, M = ContestApplicationModel, ContestApplicationMemberModel
        applied = (select(M.user_id).join(A, A.id == M.application_id)
                   .where(A.created_by == coach_id, A.created_as == ApplicationCreator.COACH))
        linked = select(CoachLinkModel.athlete_id).where(
            CoachLinkModel.coach_id == coach_id, CoachLinkModel.status == CoachLinkStatus.ACTIVE
        )
        query = (select(UserModel)
                 .where(or_(UserModel.id.in_(applied), UserModel.id.in_(linked)), UserModel.is_active)
                 .order_by(UserModel.last_name, UserModel.first_name))
        return (await self._db.scalars(query)).all()

    async def judges(self, q: str | None) -> Sequence[UserModel]:
        """Возвращает активных судей с подтверждённой ролью, опционально по подстроке имени или почты."""
        query = (select(UserModel).join(UserRoleModel, UserRoleModel.user_id == UserModel.id)
                 .where(UserRoleModel.role == Role.JUDGE, UserRoleModel.status == RoleStatus.VERIFIED, UserModel.is_active))
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            query = query.where(or_(UserModel.last_name.ilike(pattern), UserModel.first_name.ilike(pattern),
                                    UserModel.email.ilike(pattern)))
        return (await self._db.scalars(query.order_by(UserModel.last_name, UserModel.first_name).limit(50))).all()
