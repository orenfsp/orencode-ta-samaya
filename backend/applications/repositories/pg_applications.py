from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus, ContestStatus
from infrastructure.account.user import UserModel

A = ContestApplicationModel
M = ContestApplicationMemberModel


def _fresh(statement: Select) -> Select:
    """Включает перечитывание уже загруженных объектов для запроса."""
    return statement.execution_options(populate_existing=True)


@dataclass(frozen=True, slots=True)
class ApplicationQuery:
    contest_id: int
    statuses: frozenset[ApplicationStatus]
    search: str | None = None


class ApplicationRepository:
    """Доступ к заявкам на соревнования в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, application_id: int) -> ContestApplicationModel | None:
        """Возвращает заявку по id."""
        return await self._db.scalar(_fresh(select(A).where(A.id == application_id)))

    async def lock(self, application_id: int) -> ContestApplicationModel | None:
        """Блокирует и возвращает заявку по id."""
        return await self._db.scalar(_fresh(select(A).where(A.id == application_id).with_for_update()))

    async def lock_many(self, application_ids: Sequence[int]) -> list[ContestApplicationModel]:
        """Блокирует и возвращает несколько заявок по списку id."""
        items = await self._db.scalars(
            _fresh(select(A).where(A.id.in_(application_ids)).order_by(A.id).with_for_update())
        )
        return list(items.all())

    async def add(self, item: ContestApplicationModel) -> ContestApplicationModel:
        """Добавляет новую заявку."""
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(self, item: ContestApplicationModel, values: dict[str, Any]) -> ContestApplicationModel:
        """Обновляет поля заявки указанными значениями."""
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item

    async def team_name_taken(self, contest_id: int, name: str, exclude_id: int | None) -> bool:
        """Проверяет, занято ли название команды на соревновании другой неотозванной заявкой."""
        conditions = [
            A.contest_id == contest_id,
            func.lower(A.team_name) == name.lower(),
            A.status != ApplicationStatus.WITHDRAWN,
        ]
        if exclude_id is not None:
            conditions.append(A.id != exclude_id)
        return bool(await self._db.scalar(select(func.count()).select_from(A).where(*conditions)))

    async def list_for_member(self, user_id: UUID) -> Sequence[ContestApplicationModel]:
        """Возвращает заявки, в которых пользователь состоит участником, новые соревнования впереди."""
        member_of = select(M.application_id).where(M.user_id == user_id)
        items = await self._db.scalars(
            select(A)
            .join(ContestModel, ContestModel.id == A.contest_id)
            .where(A.id.in_(member_of))
            .order_by(ContestModel.starts_on.desc(), A.id.desc())
        )
        return items.all()

    async def list_for_coach(self, user_id: UUID) -> Sequence[ContestApplicationModel]:
        """Возвращает заявки, созданные тренером, новые соревнования впереди."""
        items = await self._db.scalars(
            select(A)
            .join(ContestModel, ContestModel.id == A.contest_id)
            .where(A.created_by == user_id, A.created_as == ApplicationCreator.COACH)
            .order_by(ContestModel.starts_on.desc(), A.id.desc())
        )
        return items.all()

    async def list_for_contest(
        self, query: ApplicationQuery, limit: int, offset: int
    ) -> tuple[Sequence[ContestApplicationModel], int]:
        """Возвращает страницу заявок соревнования по статусам и поисковой строке с общим количеством."""
        conditions: list[Any] = [A.contest_id == query.contest_id, A.status.in_(query.statuses)]
        if query.search:
            pattern = f"%{query.search}%"
            full_name = func.concat_ws(" ", UserModel.last_name, UserModel.first_name, UserModel.middle_name)
            by_member = (
                select(M.application_id)
                .join(UserModel, UserModel.id == M.user_id)
                .where(or_(full_name.ilike(pattern), UserModel.email.ilike(pattern)))
            )
            conditions.append(or_(A.team_name.ilike(pattern), A.id.in_(by_member)))
        total = await self._db.scalar(select(func.count()).select_from(A).where(*conditions))
        pending_first = func.coalesce(A.status == ApplicationStatus.SUBMITTED, False).desc()
        items = await self._db.scalars(
            select(A)
            .where(*conditions)
            .order_by(pending_first, A.submitted_at.asc().nulls_last(), A.created_at.asc(), A.id)
            .limit(limit)
            .offset(offset)
        )
        return items.all(), total or 0

    async def list_approved(self, contest_id: int) -> Sequence[ContestApplicationModel]:
        """Возвращает одобренные заявки соревнования, отсортированные по названию команды."""
        items = await self._db.scalars(
            select(A)
            .where(A.contest_id == contest_id, A.status == ApplicationStatus.APPROVED)
            .order_by(func.lower(A.team_name).nulls_last(), A.id)
        )
        return items.all()

    async def contest_counts(
        self, organizer_id: UUID | None, limit: int, offset: int
    ) -> tuple[list[tuple[ContestModel, dict[ApplicationStatus, int]]], int]:
        """Возвращает соревнования с заявками и количеством заявок по статусам, соревнования с ожидающими — первыми."""
        conditions: list[Any] = [A.status != ApplicationStatus.WITHDRAWN]
        if organizer_id is not None:
            conditions.append(ContestModel.organizer_id == organizer_id)
        with_applications = (
            select(A.contest_id)
            .join(ContestModel, ContestModel.id == A.contest_id)
            .where(*conditions)
            .distinct()
        )
        total = await self._db.scalar(select(func.count()).select_from(with_applications.subquery()))
        waiting = (
            select(func.count())
            .select_from(A)
            .where(A.contest_id == ContestModel.id, A.status == ApplicationStatus.SUBMITTED)
            .scalar_subquery()
        )
        contests = (
            await self._db.scalars(
                select(ContestModel)
                .where(ContestModel.id.in_(with_applications))
                .order_by((waiting > 0).desc(), ContestModel.starts_on.asc(), ContestModel.id)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        rows = await self._db.execute(
            select(A.contest_id, A.status, func.count())
            .where(A.contest_id.in_([item.id for item in contests]))
            .group_by(A.contest_id, A.status)
        )
        counts: dict[int, dict[ApplicationStatus, int]] = {item.id: dict.fromkeys(ApplicationStatus, 0) for item in contests}
        for contest_id, status, count in rows.tuples():
            counts[contest_id][status] = count
        return [(item, counts[item.id]) for item in contests], total or 0

    async def open_contests(self, now: datetime, exclude_user_id: UUID | None) -> Sequence[ContestModel]:
        """Возвращает соревнования с открытой регистрацией; при указанном пользователе исключает те, где он уже активен."""
        conditions: list[Any] = [
            ContestModel.status == ContestStatus.REGISTRATION_OPEN,
            ContestModel.registration_opens_at <= now,
            ContestModel.registration_closes_at >= now,
        ]
        if exclude_user_id is not None:
            taken = select(M.contest_id).where(M.user_id == exclude_user_id, M.is_active)
            conditions.append(ContestModel.id.not_in(taken))
        items = await self._db.scalars(
            select(ContestModel)
            .where(*conditions)
            .order_by(ContestModel.registration_closes_at.asc(), ContestModel.id)
        )
        return items.all()
