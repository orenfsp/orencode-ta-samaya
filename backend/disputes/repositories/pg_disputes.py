from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.user import UserModel
from infrastructure.contests.contest import ContestModel
from infrastructure.disputes.appeal import AppealModel
from infrastructure.disputes.violation import ViolationModel
from infrastructure.enums import AppealStatus, ApplicationStatus, CoachLinkStatus, ViolationStatus
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.sport.coach_link import CoachLinkModel

A, M, R = ContestApplicationModel, ContestApplicationMemberModel, ContestResultModel


def _coached(user_id: UUID):
    """Условие «в заявке есть участник, у которого человек — тренер по активной связи»."""
    return exists().where(
        M.application_id == A.id, M.is_active,
        exists().where(CoachLinkModel.athlete_id == M.user_id, CoachLinkModel.coach_id == user_id, CoachLinkModel.status == CoachLinkStatus.ACTIVE),
    )


class DisputeRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def contest(self, contest_id: int) -> ContestModel | None:
        """Возвращает соревнование по id или None."""
        return await self._db.get(ContestModel, contest_id)

    async def application(self, application_id: int) -> ContestApplicationModel | None:
        """Возвращает заявку по id или None."""
        return await self._db.get(A, application_id)

    async def appeal(self, appeal_id: UUID) -> AppealModel | None:
        """Возвращает апелляцию по id или None."""
        return await self._db.get(AppealModel, appeal_id)

    async def violation(self, violation_id: UUID) -> ViolationModel | None:
        """Возвращает рапорт о нарушении по id или None."""
        return await self._db.get(ViolationModel, violation_id)

    async def fresh_appeal(self, appeal_id: UUID) -> AppealModel:
        """Перечитывает апелляцию со всеми связями после сохранения."""
        return (await self._db.scalars(select(AppealModel).where(AppealModel.id == appeal_id).execution_options(populate_existing=True))).one()

    async def fresh_violation(self, violation_id: UUID) -> ViolationModel:
        """Перечитывает рапорт со всеми связями после сохранения."""
        return (await self._db.scalars(select(ViolationModel).where(ViolationModel.id == violation_id).execution_options(populate_existing=True))).one()

    async def add(self, item: AppealModel | ViolationModel) -> None:
        """Добавляет апелляцию или рапорт и получает его id."""
        self._db.add(item)
        await self._db.flush()

    async def open_appeal(self, application_id: int) -> AppealModel | None:
        """Возвращает поданную или рассматриваемую апелляцию по заявке или None."""
        return await self._db.scalar(
            select(AppealModel).where(
                AppealModel.application_id == application_id,
                AppealModel.status.in_((AppealStatus.SUBMITTED, AppealStatus.REVIEWING)),
            )
        )

    async def places(self, contest_id: int) -> dict[int, int | None]:
        """Возвращает места одобренных заявок соревнования: заявка → место, None — дисквалификация."""
        rows = await self._db.execute(
            select(R.application_id, R.place)
            .join(A, A.id == R.application_id)
            .where(R.contest_id == contest_id, A.status == ApplicationStatus.APPROVED)
            .distinct()
        )
        return dict(rows.tuples().all())

    async def judge_ids(self, contest_id: int) -> set[UUID]:
        """Возвращает id судей действующей коллегии соревнования."""
        rows = await self._db.scalars(
            select(JudgeAssignmentModel.judge_id).where(
                JudgeAssignmentModel.contest_id == contest_id, JudgeAssignmentModel.removed_at.is_(None)
            )
        )
        return set(rows.all())

    async def appealable(self, user_id: UUID, statuses: Sequence[str], ends_after: date) -> Sequence[tuple[ContestModel, ContestApplicationModel]]:
        """Одобренные заявки соревнований в статусах statuses, окончившихся не раньше ends_after, где человек автор, участник или тренер участника по активной связи."""
        rows = await self._db.execute(
            select(ContestModel, A)
            .join(A, A.contest_id == ContestModel.id)
            .where(
                ContestModel.status.in_(statuses), ContestModel.ends_on >= ends_after, A.status == ApplicationStatus.APPROVED,
                or_(A.created_by == user_id, exists().where(M.application_id == A.id, M.user_id == user_id, M.is_active), _coached(user_id)),
            )
            .order_by(ContestModel.ends_on.desc(), A.id)
        )
        return rows.tuples().all()

    async def entries(self, contest_id: int, user_id: UUID) -> Sequence[ContestApplicationModel]:
        """Возвращает одобренные заявки соревнования, где человек участник, автор заявки или тренер участника по активной связи."""
        rows = await self._db.scalars(
            select(A).where(
                A.contest_id == contest_id, A.status == ApplicationStatus.APPROVED,
                or_(A.created_by == user_id, exists().where(M.application_id == A.id, M.user_id == user_id, M.is_active), _coached(user_id)),
            ).order_by(A.id)
        )
        return rows.all()

    async def participants(self, contest_id: int) -> Sequence[tuple[int, UserModel, str | None]]:
        """Возвращает активных участников одобренных заявок: заявка, человек, команда."""
        rows = await self._db.execute(
            select(A.id, UserModel, A.team_name)
            .join(M, and_(M.application_id == A.id, M.is_active))
            .join(UserModel, UserModel.id == M.user_id)
            .where(A.contest_id == contest_id, A.status == ApplicationStatus.APPROVED)
            .order_by(UserModel.last_name, UserModel.first_name)
        )
        return rows.tuples().all()

    async def membership(self, contest_id: int, user_id: UUID) -> int | None:
        """Возвращает id одобренной заявки соревнования, где человек — активный участник, или None."""
        return await self._db.scalar(
            select(A.id)
            .join(M, and_(M.application_id == A.id, M.user_id == user_id, M.is_active))
            .where(A.contest_id == contest_id, A.status == ApplicationStatus.APPROVED)
        )

    async def members(self, application_id: int) -> list[UUID]:
        """Возвращает id активных участников заявки."""
        rows = await self._db.scalars(select(M.user_id).where(M.application_id == application_id, M.is_active))
        return list(rows.all())

    async def coaches(self, user_id: UUID) -> list[UUID]:
        """Возвращает id тренеров с активной связью со спортсменом."""
        rows = await self._db.scalars(
            select(CoachLinkModel.coach_id)
            .where(CoachLinkModel.athlete_id == user_id, CoachLinkModel.status == CoachLinkStatus.ACTIVE)
            .distinct()
        )
        return list(rows.all())

    async def appeals(
        self, contest_id: int | None = None, statuses: Sequence[AppealStatus] | None = None, user_id: UUID | None = None
    ) -> Sequence[AppealModel]:
        """Возвращает апелляции по соревнованию, статусам и человеку (подал, участник или автор заявки), новые первыми."""
        query = select(AppealModel).join(A, A.id == AppealModel.application_id)
        if contest_id is not None:
            query = query.where(AppealModel.contest_id == contest_id)
        if statuses:
            query = query.where(AppealModel.status.in_(statuses))
        if user_id is not None:
            query = query.where(or_(
                AppealModel.filed_by == user_id, A.created_by == user_id,
                exists().where(M.application_id == A.id, M.user_id == user_id, M.is_active),
            ))
        return (await self._db.scalars(query.order_by(AppealModel.created_at.desc()))).all()

    async def violations(
        self, contest_id: int | None = None, statuses: Sequence[ViolationStatus] | None = None, user_id: UUID | None = None
    ) -> Sequence[ViolationModel]:
        """Возвращает рапорты о нарушениях по соревнованию, статусам и нарушителю, новые первыми."""
        query = select(ViolationModel)
        if contest_id is not None:
            query = query.where(ViolationModel.contest_id == contest_id)
        if statuses:
            query = query.where(ViolationModel.status.in_(statuses))
        if user_id is not None:
            query = query.where(ViolationModel.user_id == user_id)
        return (await self._db.scalars(query.order_by(ViolationModel.created_at.desc()))).all()
