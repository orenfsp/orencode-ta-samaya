from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import Select, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contest import ContestModel
from infrastructure.contest_application import ContestApplicationModel
from infrastructure.contest_academic_group import contest_academic_groups
from infrastructure.contest_age_group import contest_age_groups
from infrastructure.enums import ContestStatus, ParticipationType, VerificationStatus


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
    # date_desc — свежие по дате начала первыми, date_asc — ближайшие первыми,
    # created_desc — недавно добавленные, title — по алфавиту. None — порядок по period
    sort: str | None = None
    order: list[Any] = field(default_factory=list)


def _fresh(statement: Select) -> Select:
    return statement.execution_options(populate_existing=True)


def _conditions(query: ContestQuery) -> list[Any]:
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
    if query.period == "upcoming":
        conditions.append(ContestModel.ends_on >= date.today())
    if query.period == "past":
        conditions.append(ContestModel.ends_on < date.today())
    return conditions


class ContestRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, contest_id: int) -> ContestModel | None:
        return await self._db.scalar(_fresh(select(ContestModel).where(ContestModel.id == contest_id)))

    async def lock(self, contest_id: int) -> ContestModel | None:
        return await self._db.scalar(
            _fresh(select(ContestModel).where(ContestModel.id == contest_id).with_for_update())
        )

    async def list(self, query: ContestQuery, limit: int, offset: int) -> tuple[Sequence[ContestModel], int]:
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
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(self, item: ContestModel, values: dict[str, Any]) -> ContestModel:
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item

    async def delete(self, item: ContestModel) -> None:
        await self._db.delete(item)
        await self._db.flush()

    async def has_applications(self, contest_id: int) -> bool:
        return bool(
            await self._db.scalar(
                select(exists().where(ContestApplicationModel.contest_id == contest_id))
            )
        )
