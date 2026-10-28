from collections.abc import Sequence
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.sport.antidoping_certificate import AntidopingCertificateModel
from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.services.reminder_log import ReminderLogModel
from infrastructure.services.report_deadline import ReportDeadlineModel
from infrastructure.enums import ApplicationStatus, CoachLinkStatus, ContestStatus, QualificationStatus, Role, RoleStatus
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel


class DeadlineRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def claim(self, source: str, object_key: str, user_id: UUID, threshold: int) -> bool:
        """Отмечает напоминание отправленным; False, если такое уже было."""
        query = (
            insert(ReminderLogModel)
            .values(source=source, object_key=object_key, user_id=user_id, threshold=threshold)
            .on_conflict_do_nothing(constraint="uq_reminder_log")
            .returning(ReminderLogModel.id)
        )
        return (await self._db.execute(query)).scalar_one_or_none() is not None

    async def closing(self, now: datetime, until: datetime) -> Sequence[ContestModel]:
        """Возвращает соревнования, чей приём заявок закрывается в заданном окне."""
        query = select(ContestModel).where(
            ContestModel.status == ContestStatus.REGISTRATION_OPEN,
            ContestModel.registration_closes_at > now,
            ContestModel.registration_closes_at <= until,
        )
        return (await self._db.scalars(query.order_by(ContestModel.registration_closes_at))).all()

    async def candidates(self, discipline_id: int, on: date) -> Sequence[UserModel]:
        """Возвращает спортсменов, занимающихся дисциплиной на дату."""
        query = (
            select(UserModel)
            .join(UserRoleModel, UserRoleModel.user_id == UserModel.id)
            .join(AthleteDisciplineModel, AthleteDisciplineModel.user_id == UserModel.id)
            .where(
                UserRoleModel.role == Role.ATHLETE, UserRoleModel.status == RoleStatus.VERIFIED, UserModel.is_active,
                AthleteDisciplineModel.discipline_id == discipline_id, AthleteDisciplineModel.valid_from <= on,
                AthleteDisciplineModel.valid_to.is_(None),
            )
            .distinct()
        )
        return (await self._db.scalars(query)).all()

    async def applied(self, contest_id: int) -> set[UUID]:
        """Возвращает id людей, уже состоящих в заявках на соревнование."""
        query = (
            select(ContestApplicationMemberModel.user_id)
            .join(ContestApplicationModel, ContestApplicationModel.id == ContestApplicationMemberModel.application_id)
            .where(
                ContestApplicationMemberModel.contest_id == contest_id, ContestApplicationMemberModel.is_active,
                ContestApplicationModel.status != ApplicationStatus.WITHDRAWN,
            )
        )
        return set((await self._db.scalars(query)).all())

    async def coaches(self, athlete_ids: Sequence[UUID], discipline_id: int) -> dict[UUID, list[UUID]]:
        """Возвращает активных тренеров спортсменов по дисциплине: спортсмен → тренеры."""
        if not athlete_ids:
            return {}
        query = select(CoachLinkModel.coach_id, CoachLinkModel.athlete_id).where(
            CoachLinkModel.athlete_id.in_(athlete_ids), CoachLinkModel.status == CoachLinkStatus.ACTIVE,
            CoachLinkModel.discipline_id == discipline_id,
        )
        grouped: dict[UUID, list[UUID]] = {}
        for coach_id, athlete_id in (await self._db.execute(query)).tuples():
            grouped.setdefault(coach_id, []).append(athlete_id)
        return grouped

    async def federation(self) -> list[UUID]:
        """Возвращает id сотрудников федерации с подтверждённой ролью."""
        query = (
            select(UserModel.id)
            .join(UserRoleModel, UserRoleModel.user_id == UserModel.id)
            .where(UserRoleModel.role == Role.FEDERATION, UserRoleModel.status == RoleStatus.VERIFIED, UserModel.is_active)
            .distinct()
        )
        return list((await self._db.scalars(query)).all())

    async def antidoping(self, until: date) -> Sequence[AntidopingCertificateModel]:
        """Возвращает последние сертификаты РУСАДА, истекающие до даты."""
        latest = (
            select(AntidopingCertificateModel.user_id, AntidopingCertificateModel.passed_on)
            .distinct(AntidopingCertificateModel.user_id)
            .order_by(AntidopingCertificateModel.user_id, AntidopingCertificateModel.passed_on.desc())
            .subquery()
        )
        query = select(AntidopingCertificateModel).join(
            latest,
            (latest.c.user_id == AntidopingCertificateModel.user_id)
            & (latest.c.passed_on == AntidopingCertificateModel.passed_on),
        ).where(AntidopingCertificateModel.valid_until <= until)
        return (await self._db.scalars(query)).all()

    async def latest_antidoping(self, user_id: UUID) -> AntidopingCertificateModel | None:
        """Возвращает последний сертификат РУСАДА человека или None."""
        query = select(AntidopingCertificateModel).where(AntidopingCertificateModel.user_id == user_id)
        return await self._db.scalar(query.order_by(AntidopingCertificateModel.passed_on.desc()).limit(1))

    async def reports(self, include_done: bool) -> Sequence[ReportDeadlineModel]:
        """Возвращает отчётные сроки по дате; сданные — если попросили."""
        query = select(ReportDeadlineModel)
        if not include_done:
            query = query.where(ReportDeadlineModel.done_at.is_(None))
        return (await self._db.scalars(query.order_by(ReportDeadlineModel.due_on))).all()

    async def report(self, report_id: int) -> ReportDeadlineModel | None:
        """Возвращает отчётный срок по id или None."""
        return await self._db.get(ReportDeadlineModel, report_id)

    async def add(self, item: ReportDeadlineModel) -> ReportDeadlineModel:
        """Добавляет отчётный срок и возвращает его с id."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def remove(self, item: ReportDeadlineModel) -> None:
        """Удаляет отчётный срок."""
        await self._db.delete(item)
        await self._db.flush()

    async def refresh(self, item: ReportDeadlineModel) -> ReportDeadlineModel:
        """Перечитывает отчётный срок из БД."""
        await self._db.refresh(item)
        return item

    async def qualifications(self, user_ids: Sequence[UUID]) -> Sequence[QualificationModel]:
        """Возвращает одобренные квалификации людей."""
        if not user_ids:
            return []
        query = select(QualificationModel).where(
            QualificationModel.user_id.in_(user_ids), QualificationModel.status == QualificationStatus.APPROVED,
            QualificationModel.valid_until.is_not(None),
        )
        return (await self._db.scalars(query)).all()

    async def coach_athletes(self, coach_id: UUID) -> list[UUID]:
        """Возвращает id спортсменов с активной связью у тренера."""
        query = select(CoachLinkModel.athlete_id).where(
            CoachLinkModel.coach_id == coach_id, CoachLinkModel.status == CoachLinkStatus.ACTIVE
        )
        return list(set((await self._db.scalars(query)).all()))

    async def open_contests(self, until: datetime) -> Sequence[ContestModel]:
        """Возвращает соревнования с открытым приёмом заявок, закрывающимся до момента."""
        query = select(ContestModel).where(
            ContestModel.status == ContestStatus.REGISTRATION_OPEN, ContestModel.registration_closes_at <= until
        )
        return (await self._db.scalars(query.order_by(ContestModel.registration_closes_at))).all()

    async def user(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id или None."""
        return await self._db.get(UserModel, user_id)
