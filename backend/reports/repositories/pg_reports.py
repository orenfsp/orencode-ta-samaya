from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from sqlalchemy import and_, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.user import UserModel
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus, CoachLinkStatus, ContestStatus
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.sport.athlete_profile import AthleteProfileModel

A, M, R, C = ContestApplicationModel, ContestApplicationMemberModel, ContestResultModel, ContestModel
HELD = (ContestStatus.IN_PROGRESS, ContestStatus.COMPLETED, ContestStatus.ARCHIVED)


@dataclass(frozen=True, slots=True)
class Start:
    contest: ContestModel
    team_name: str | None
    entered: bool
    place: int | None
    points: int
    members: list[UserModel] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class Coached:
    contest: ContestModel
    athlete: UserModel
    team_name: str | None
    place: int | None


class ReportRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def user(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id или None, если такого нет."""
        return await self._db.get(UserModel, user_id)

    async def starts(self, user_id: UUID, since: date, until: date) -> list[Start]:
        """Возвращает выступления человека за период с местом и баллами."""
        result = await self._db.execute(
            select(C, A, A.id, R.place, R.points)
            .join(A, A.contest_id == C.id)
            .join(M, and_(M.application_id == A.id, M.user_id == user_id, M.is_active))
            .outerjoin(R, and_(R.application_id == A.id, R.user_id == user_id))
            .where(A.status == ApplicationStatus.APPROVED, C.status.in_(HELD), C.starts_on <= until, C.ends_on >= since)
            .order_by(C.starts_on.desc(), C.id.desc())
        )
        rows = list(result.tuples())
        entered = await self._entered([row[2] for row in rows])
        return [
            Start(contest, application.team_name, application_id in entered, place, points or 0, [member.user for member in application.members if member.is_active])
            for contest, application, application_id, place, points in rows
        ]

    async def coached(self, coach_id: UUID, since: date, until: date) -> list[Coached]:
        """Возвращает выступления подопечных тренера за период."""
        rows = await self._db.execute(
            select(C, UserModel, A.team_name, R.place)
            .join(A, A.contest_id == C.id)
            .join(M, and_(M.application_id == A.id, M.is_active))
            .join(UserModel, UserModel.id == M.user_id)
            .outerjoin(R, and_(R.application_id == A.id, R.user_id == M.user_id))
            .where(
                A.created_by == coach_id, A.created_as == ApplicationCreator.COACH,
                A.status == ApplicationStatus.APPROVED, C.status.in_(HELD), C.starts_on <= until, C.ends_on >= since,
            )
            .order_by(C.starts_on.desc(), C.id.desc(), UserModel.last_name)
        )
        return [Coached(contest, athlete, team, place) for contest, athlete, team, place in rows.tuples()]

    async def judged(self, judge_id: UUID, since: date, until: date) -> Sequence[JudgeAssignmentModel]:
        """Возвращает судейские назначения человека на соревнованиях за период."""
        query = (
            select(JudgeAssignmentModel)
            .join(C, C.id == JudgeAssignmentModel.contest_id)
            .where(
                JudgeAssignmentModel.judge_id == judge_id, JudgeAssignmentModel.removed_at.is_(None),
                C.starts_on <= until, C.ends_on >= since,
            )
            .order_by(C.starts_on.desc(), C.id.desc())
        )
        return (await self._db.scalars(query)).all()

    async def coaches(self, coach_id: UUID, athlete_id: UUID) -> bool:
        """Проверяет, тренирует ли тренер спортсмена: по активной связи или по одобренной заявке."""
        linked = select(
            exists().where(
                CoachLinkModel.coach_id == coach_id, CoachLinkModel.athlete_id == athlete_id,
                CoachLinkModel.status == CoachLinkStatus.ACTIVE,
            )
        )
        if await self._db.scalar(linked):
            return True
        query = select(
            exists().where(
                A.created_by == coach_id, A.created_as == ApplicationCreator.COACH,
                A.status == ApplicationStatus.APPROVED,
                exists().where(M.application_id == A.id, M.user_id == athlete_id, M.is_active),
            )
        )
        return bool(await self._db.scalar(query))

    async def _entered(self, application_ids: list[int]) -> set[int]:
        """Возвращает id заявок, по которым уже есть результат (не дисквалифицированы)."""
        if not application_ids:
            return set()
        rows = await self._db.scalars(select(R.application_id).where(R.application_id.in_(application_ids)).distinct())
        return set(rows.all())

    async def profile(self, user_id: UUID) -> AthleteProfileModel | None:
        """Возвращает спортивный профиль человека с организацией для отчёта."""
        return await self._db.get(AthleteProfileModel, user_id)
