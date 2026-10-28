from collections import defaultdict
from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.sport.athlete_organization import AthleteOrganizationModel
from infrastructure.sport.athlete_profile import AthleteProfileModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import CoachLinkStatus, QualificationKind, QualificationStatus, Role, RoleStatus
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel
from infrastructure.training.group_enrollment import GroupEnrollmentModel


class RegistryRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def people(self, role: Role) -> Sequence[UserModel]:
        """Возвращает активных людей с подтверждённой ролью."""
        query = (
            select(UserModel)
            .join(UserRoleModel, UserRoleModel.user_id == UserModel.id)
            .where(UserRoleModel.role == role, UserRoleModel.status == RoleStatus.VERIFIED, UserModel.is_active)
            .order_by(UserModel.last_name, UserModel.first_name)
        )
        return (await self._db.scalars(query)).all()

    async def profiles(self) -> dict[UUID, AthleteProfileModel]:
        """Возвращает спортивные профили: человек → профиль."""
        return {item.user_id: item for item in (await self._db.scalars(select(AthleteProfileModel))).all()}

    async def disciplines(self) -> Sequence[AthleteDisciplineModel]:
        """Возвращает все периоды дисциплин спортсменов."""
        return (await self._db.scalars(select(AthleteDisciplineModel))).all()

    async def organization_periods(self) -> Sequence[AthleteOrganizationModel]:
        """Возвращает все периоды организаций спортсменов."""
        return (await self._db.scalars(select(AthleteOrganizationModel))).all()

    async def qualifications(self, kind: QualificationKind) -> dict[UUID, QualificationModel]:
        """Возвращает одобренные квалификации вида: человек → квалификация."""
        query = select(QualificationModel).where(
            QualificationModel.kind == kind, QualificationModel.status == QualificationStatus.APPROVED
        )
        return {item.user_id: item for item in (await self._db.scalars(query)).all()}

    async def coaches_of(self) -> dict[UUID, list[CoachLinkModel]]:
        """Возвращает активные связи по спортсменам: спортсмен → связи."""
        query = select(CoachLinkModel).where(CoachLinkModel.status == CoachLinkStatus.ACTIVE)
        grouped: dict[UUID, list[CoachLinkModel]] = defaultdict(list)
        for link in (await self._db.scalars(query)).all():
            grouped[link.athlete_id].append(link)
        return grouped

    async def athletes_of(self) -> dict[UUID, list[CoachLinkModel]]:
        """Возвращает активные связи по тренерам: тренер → связи."""
        query = select(CoachLinkModel).where(CoachLinkModel.status == CoachLinkStatus.ACTIVE)
        grouped: dict[UUID, list[CoachLinkModel]] = defaultdict(list)
        for link in (await self._db.scalars(query)).all():
            grouped[link.coach_id].append(link)
        return grouped

    async def assignments(self, since: date) -> dict[UUID, int]:
        """Считает судейства с даты: судья → число."""
        rows = await self._db.execute(
            select(JudgeAssignmentModel.judge_id, func.count())
            .where(JudgeAssignmentModel.removed_at.is_(None), JudgeAssignmentModel.created_at >= since)
            .group_by(JudgeAssignmentModel.judge_id)
        )
        return {judge_id: count for judge_id, count in rows.tuples()}

    async def age_groups(self) -> Sequence[DictionaryAgeGroupModel]:
        """Возвращает действующие возрастные группы."""
        query = select(DictionaryAgeGroupModel).where(DictionaryAgeGroupModel.is_archived.is_(False))
        return (await self._db.scalars(query.order_by(DictionaryAgeGroupModel.id))).all()

    async def enrollments(self) -> Sequence[GroupEnrollmentModel]:
        """Возвращает все зачисления в учебно-тренировочные группы с группой."""
        return (await self._db.scalars(select(GroupEnrollmentModel))).all()
