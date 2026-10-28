from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionaries.dictionary_contest_format import DictionaryContestFormatModel
from infrastructure.dictionaries.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_judge_category import DictionaryJudgeCategoryModel
from infrastructure.dictionaries.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.enums import (
    ApplicationCreator,
    ApplicationStatus,
    ContestStatus,
    MemberConfirmation,
    QualificationKind,
    QualificationStatus,
)
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel

A = ContestApplicationModel
M = ContestApplicationMemberModel
C = ContestModel
COUNTED = (ContestStatus.DRAFT, ContestStatus.CANCELLED)


@dataclass(frozen=True, slots=True)
class Participation:
    user_id: UUID
    contest_id: int
    application_id: int
    starts_on: date
    discipline_id: int
    municipality_id: int | None
    age_group_id: int | None
    academic_group_id: int | None
    coach_id: UUID | None


@dataclass(frozen=True, slots=True)
class ContestRow:
    id: int
    starts_on: date
    ends_on: date
    discipline_id: int
    municipality_id: int | None
    level: str
    format: str
    status: ContestStatus


@dataclass(frozen=True, slots=True)
class ApplicationRow:
    id: int
    starts_on: date
    discipline_id: int
    status: ApplicationStatus
    reject_reason: str | None
    members: tuple[tuple[int | None, int | None, int | None], ...]


@dataclass(frozen=True, slots=True)
class ResultRow:
    user_id: UUID
    application_id: int
    contest_id: int
    starts_on: date
    discipline_id: int
    place: int | None
    points: int


@dataclass(frozen=True, slots=True)
class AssignmentRow:
    judge_id: UUID
    contest_id: int
    starts_on: date
    ends_on: date
    discipline_id: int
    position: str


@dataclass(frozen=True, slots=True)
class QualificationRow:
    user_id: UUID
    kind: QualificationKind
    name: str
    decided_at: datetime
    municipality_id: int | None


class AnalyticsRepository:
    """Доступ к данным аналитики: участия, соревнования, заявки, результаты, судьи и разряды."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def participations(self) -> list[Participation]:
        """Возвращает одобренные участия активных членов заявок."""
        coach = (A.created_by).label("coach")
        statement: Select = (
            select(
                M.user_id, C.id, A.id, C.starts_on, C.discipline_id, UserModel.municipality_id,
                M.age_group_id, M.academic_group_id, coach, A.created_as,
            )
            .join(A, A.id == M.application_id)
            .join(C, C.id == A.contest_id)
            .join(UserModel, UserModel.id == M.user_id)
            .where(
                A.status == ApplicationStatus.APPROVED,
                M.is_active,
                M.confirmation != MemberConfirmation.DECLINED,
                C.status.not_in(COUNTED),
            )
        )
        rows = await self._db.execute(statement)
        return [
            Participation(
                user_id=row[0], contest_id=row[1], application_id=row[2], starts_on=row[3], discipline_id=row[4],
                municipality_id=row[5], age_group_id=row[6], academic_group_id=row[7],
                coach_id=row[8] if row[9] == ApplicationCreator.COACH else None,
            )
            for row in rows.tuples()
        ]

    async def contests(self) -> list[ContestRow]:
        """Возвращает соревнования, кроме черновиков."""
        rows = await self._db.execute(
            select(
                C.id, C.starts_on, C.ends_on, C.discipline_id, C.municipality_id,
                DictionaryContestLevelModel.name, DictionaryContestFormatModel.name, C.status,
            )
            .join(DictionaryContestLevelModel, DictionaryContestLevelModel.id == C.contest_level_id)
            .join(DictionaryContestFormatModel, DictionaryContestFormatModel.id == C.contest_format_id)
            .where(C.status != ContestStatus.DRAFT)
        )
        return [ContestRow(*row) for row in rows.tuples()]

    async def applications(self) -> list[ApplicationRow]:
        """Возвращает заявки на соревнования (кроме черновиков) вместе с данными их активных членов."""
        rows = await self._db.execute(
            select(A.id, C.starts_on, C.discipline_id, A.status, A.reject_reason)
            .join(C, C.id == A.contest_id)
            .where(C.status != ContestStatus.DRAFT, A.status != ApplicationStatus.FORMING)
        )
        members: dict[int, list[tuple[int | None, int | None, int | None]]] = {}
        member_rows = await self._db.execute(
            select(M.application_id, UserModel.municipality_id, M.age_group_id, M.academic_group_id)
            .join(UserModel, UserModel.id == M.user_id)
            .where(M.is_active)
        )
        for application_id, municipality_id, age_group_id, academic_group_id in member_rows.tuples():
            members.setdefault(application_id, []).append((municipality_id, age_group_id, academic_group_id))
        return [
            ApplicationRow(row[0], row[1], row[2], row[3], row[4], tuple(members.get(row[0], [])))
            for row in rows.tuples()
        ]

    async def results(self) -> list[ResultRow]:
        """Возвращает результаты участников соревнований."""
        rows = await self._db.execute(
            select(
                ContestResultModel.user_id, ContestResultModel.application_id, C.id, C.starts_on, C.discipline_id,
                ContestResultModel.place, ContestResultModel.points,
            ).join(C, C.id == ContestResultModel.contest_id)
        )
        return [ResultRow(*row) for row in rows.tuples()]

    async def assignments(self) -> list[AssignmentRow]:
        """Возвращает назначения судей на соревнования, кроме черновиков и отменённых."""
        rows = await self._db.execute(
            select(
                JudgeAssignmentModel.judge_id, C.id, C.starts_on, C.ends_on, C.discipline_id,
                DictionaryJudgePositionModel.name,
            )
            .join(C, C.id == JudgeAssignmentModel.contest_id)
            .join(DictionaryJudgePositionModel, DictionaryJudgePositionModel.id == JudgeAssignmentModel.position_id)
            .where(C.status.not_in(COUNTED), JudgeAssignmentModel.removed_at.is_(None))
        )
        return [AssignmentRow(*row) for row in rows.tuples()]

    async def qualifications(self) -> list[QualificationRow]:
        """Возвращает присвоенные или заменённые решением разряды и судейские категории."""
        rows = await self._db.execute(
            select(
                QualificationModel.user_id, QualificationModel.kind,
                func.coalesce(DictionaryRankTypeModel.name, DictionaryJudgeCategoryModel.name, "—"),
                QualificationModel.decided_at, UserModel.municipality_id,
            )
            .join(UserModel, UserModel.id == QualificationModel.user_id)
            .outerjoin(DictionaryRankTypeModel, DictionaryRankTypeModel.id == QualificationModel.rank_type_id)
            .outerjoin(
                DictionaryJudgeCategoryModel, DictionaryJudgeCategoryModel.id == QualificationModel.judge_category_id
            )
            .where(
                QualificationModel.status.in_((QualificationStatus.APPROVED, QualificationStatus.SUPERSEDED)),
                QualificationModel.decided_at.is_not(None),
            )
        )
        return [QualificationRow(user_id, kind, name, cast(datetime, decided_at), municipality_id)
                for user_id, kind, name, decided_at, municipality_id in rows.tuples()]

    async def judge_categories(self) -> dict[UUID, str]:
        """Возвращает текущую (последнюю присвоенную) судейскую категорию каждого судьи."""
        rows = await self._db.execute(
            select(QualificationModel.user_id, DictionaryJudgeCategoryModel.name, QualificationModel.decided_at)
            .join(DictionaryJudgeCategoryModel, DictionaryJudgeCategoryModel.id == QualificationModel.judge_category_id)
            .where(
                QualificationModel.kind == QualificationKind.JUDGE_CATEGORY,
                QualificationModel.status == QualificationStatus.APPROVED,
            )
            .order_by(QualificationModel.decided_at)
        )
        return {user_id: category for user_id, category, _ in rows.tuples()}

    async def names(self, user_ids: Sequence[UUID]) -> dict[UUID, str]:
        """Возвращает полные имена пользователей по их id."""
        if not user_ids:
            return {}
        full_name = func.concat_ws(" ", UserModel.last_name, UserModel.first_name, UserModel.middle_name)
        rows = await self._db.execute(select(UserModel.id, full_name).where(UserModel.id.in_(user_ids)))
        return {user_id: name for user_id, name in rows.tuples()}

    async def dictionary(self, model: type) -> dict[int, str]:
        """Возвращает все записи справочника model как словарь id -> название."""
        rows = await self._db.execute(select(model.id, model.name))
        return {row[0]: row[1] for row in rows.tuples()}

    async def disciplines(self) -> dict[int, str]:
        """Возвращает справочник дисциплин."""
        return await self.dictionary(DictionaryDisciplineModel)

    async def municipalities(self) -> dict[int, str]:
        """Возвращает справочник муниципалитетов."""
        return await self.dictionary(DictionaryMunicipalityModel)

    async def age_groups(self) -> dict[int, str]:
        """Возвращает справочник возрастных групп."""
        return await self.dictionary(DictionaryAgeGroupModel)

    async def academic_groups(self) -> dict[int, str]:
        """Возвращает справочник академических групп."""
        return await self.dictionary(DictionaryAcademicGroupModel)
