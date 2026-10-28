from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import Select, case, exists, func, or_, select, union, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.contests.contest_academic_group import contest_academic_groups
from infrastructure.contests.contest_age_group import contest_age_groups
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.enums import (
    ApplicationCreator,
    ApplicationStatus,
    ContestStatus,
    ParticipationType,
    VerificationStatus,
)

LIVE_APPLICATIONS = (ApplicationStatus.FORMING, ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED)


@dataclass(slots=True)
class ContestQuery:
    statuses: frozenset[ContestStatus] | None = None
    organizer_id: UUID | None = None
    discipline_id: int | None = None
    contest_level_id: int | None = None
    contest_format_id: int | None = None
    participation_type: ParticipationType | None = None
    age_group_id: int | None = None
    academic_group_id: int | None = None
    municipality_id: int | None = None
    verification_status: VerificationStatus | None = None
    verified_only: bool = False
    has_prize_fund: bool = False
    date_from: date | None = None
    date_to: date | None = None
    search: str | None = None
    period: str | None = None
    today: date | None = None
    # date_desc — свежие по дате начала первыми, date_asc — ближайшие первыми,
    # created_desc — недавно добавленные, title — по алфавиту. None — порядок по period
    sort: str | None = None
    order: list[Any] = field(default_factory=list)


def _fresh(statement: Select) -> Select:
    """Включает перечитывание уже загруженных объектов для запроса."""
    return statement.execution_options(populate_existing=True)


def _conditions(query: ContestQuery) -> list[Any]:
    """Строит список условий SQL-фильтра соревнований из полей ContestQuery."""
    conditions: list[Any] = []
    if query.statuses is not None:
        conditions.append(ContestModel.status.in_(query.statuses))
    if query.organizer_id is not None:
        conditions.append(ContestModel.organizer_id == query.organizer_id)
    if query.discipline_id is not None:
        conditions.append(ContestModel.discipline_id == query.discipline_id)
    if query.contest_level_id is not None:
        conditions.append(ContestModel.contest_level_id == query.contest_level_id)
    if query.contest_format_id is not None:
        conditions.append(ContestModel.contest_format_id == query.contest_format_id)
    if query.participation_type is not None:
        conditions.append(ContestModel.participation_type == query.participation_type)
    if query.municipality_id is not None:
        conditions.append(ContestModel.municipality_id == query.municipality_id)
    if query.age_group_id is not None:
        conditions.append(
            exists().where(
                contest_age_groups.c.contest_id == ContestModel.id,
                contest_age_groups.c.age_group_id == query.age_group_id,
            )
        )
    if query.academic_group_id is not None:
        conditions.append(
            exists().where(
                contest_academic_groups.c.contest_id == ContestModel.id,
                contest_academic_groups.c.academic_group_id == query.academic_group_id,
            )
        )
    if query.verification_status is not None:
        conditions.append(ContestModel.verification_status == query.verification_status)
    if query.verified_only:
        conditions.append(ContestModel.verification_status == VerificationStatus.VERIFIED)
    if query.has_prize_fund:
        conditions.append(
            or_(ContestModel.prize_fund_text.is_not(None), ContestModel.prize_fund_amount.is_not(None))
        )
    if query.date_from is not None:
        conditions.append(ContestModel.ends_on >= query.date_from)
    if query.date_to is not None:
        conditions.append(ContestModel.starts_on <= query.date_to)
    if query.search:
        conditions.append(ContestModel.title.ilike(f"%{query.search.strip()}%"))
    if query.period == "upcoming" and query.today is not None:
        conditions.append(ContestModel.ends_on >= query.today)
    if query.period == "past" and query.today is not None:
        conditions.append(ContestModel.ends_on < query.today)
    return conditions


class ContestRepository:
    """Доступ к соревнованиям в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, contest_id: int) -> ContestModel | None:
        """Возвращает соревнование по id."""
        return await self._db.scalar(_fresh(select(ContestModel).where(ContestModel.id == contest_id)))

    async def lock(self, contest_id: int) -> ContestModel | None:
        """Блокирует и возвращает соревнование по id."""
        return await self._db.scalar(
            _fresh(select(ContestModel).where(ContestModel.id == contest_id).with_for_update())
        )

    async def list(self, query: ContestQuery, limit: int, offset: int) -> tuple[Sequence[ContestModel], int]:
        """Возвращает страницу соревнований по фильтру с общим количеством."""
        conditions = _conditions(query)
        total = await self._db.scalar(select(func.count()).select_from(ContestModel).where(*conditions))
        sorts = {
            "date_desc": [ContestModel.starts_on.desc(), ContestModel.id.desc()],
            "date_asc": [ContestModel.starts_on.asc(), ContestModel.id.asc()],
            "created_desc": [ContestModel.created_at.desc(), ContestModel.id.desc()],
            "title": [func.lower(ContestModel.title).asc(), ContestModel.id.asc()],
        }
        if query.sort in sorts:
            order = sorts[query.sort]
        elif query.period == "past":
            order = [ContestModel.starts_on.desc(), ContestModel.id.desc()]
        elif query.period == "upcoming":
            order = [ContestModel.starts_on.asc(), ContestModel.id.asc()]
        else:
            order = query.order or [ContestModel.starts_on.desc(), ContestModel.id.desc()]
        items = await self._db.scalars(
            select(ContestModel).where(*conditions).order_by(*order).limit(limit).offset(offset)
        )
        return items.all(), total or 0

    async def add(self, item: ContestModel) -> ContestModel:
        """Добавляет новое соревнование."""
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(self, item: ContestModel, values: dict[str, Any]) -> ContestModel:
        """Обновляет поля соревнования указанными значениями."""
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item

    async def delete(self, item: ContestModel) -> None:
        """Удаляет соревнование."""
        await self._db.delete(item)
        await self._db.flush()

    async def has_applications(self, contest_id: int) -> bool:
        """Проверяет, есть ли у соревнования хотя бы одна заявка."""
        return bool(
            await self._db.scalar(
                select(exists().where(ContestApplicationModel.contest_id == contest_id))
            )
        )

    async def participant_ids(self, contest_id: int) -> Sequence[UUID]:
        """Возвращает id всех активных участников и тренеров-создателей заявок соревнования."""
        live = (ContestApplicationModel.contest_id == contest_id, ContestApplicationModel.status.in_(LIVE_APPLICATIONS))
        members = (
            select(ContestApplicationMemberModel.user_id)
            .join(ContestApplicationModel, ContestApplicationModel.id == ContestApplicationMemberModel.application_id)
            .where(*live, ContestApplicationMemberModel.is_active.is_(True))
        )
        coaches = select(ContestApplicationModel.created_by).where(
            *live, ContestApplicationModel.created_as == ApplicationCreator.COACH
        )
        return (await self._db.scalars(union(members, coaches))).all()

    async def reprice_results(self, contest_id: int, rating_points: Sequence[dict[str, int]] | None) -> None:
        """Пересчитывает очки результатов соревнования по новой таблице баллов за места."""
        table = {row["place"]: row["points"] for row in rating_points or []}
        points = case(table, value=ContestResultModel.place, else_=0) if table else 0
        await self._db.execute(
            update(ContestResultModel).where(ContestResultModel.contest_id == contest_id).values(points=points)
        )
