from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.sport.athlete_profile import AthleteProfileModel
from infrastructure.sport.organization import OrganizationModel

O = OrganizationModel


class OrganizationRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, organization_id: int) -> OrganizationModel | None:
        """Возвращает организацию по id или None."""
        return await self._db.get(O, organization_id)

    async def by_name(self, name: str) -> OrganizationModel | None:
        """Возвращает организацию по названию без учёта регистра или None."""
        return await self._db.scalar(select(O).where(func.lower(O.name) == name.strip().lower()))

    async def search(
        self,
        q: str | None,
        municipality_id: int | None,
        organization_type_id: int | None,
        active_only: bool,
        limit: int,
        offset: int,
    ) -> tuple[Sequence[OrganizationModel], int]:
        """Ищет организации с фильтрами и возвращает страницу и общее число."""
        conditions: list[Any] = []
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            conditions.append(or_(O.name.ilike(pattern), O.short_name.ilike(pattern), O.inn.ilike(pattern)))
        if municipality_id is not None:
            conditions.append(O.municipality_id == municipality_id)
        if organization_type_id is not None:
            conditions.append(O.organization_type_id == organization_type_id)
        if active_only:
            conditions.append(O.is_active.is_(True))
        total = await self._db.scalar(select(func.count()).select_from(O).where(*conditions)) or 0
        items = await self._db.scalars(select(O).where(*conditions).order_by(O.name).limit(limit).offset(offset))
        return items.all(), total

    async def athletes_count(self, organization_ids: Sequence[int]) -> dict[int, int]:
        """Считает спортсменов в организациях: id → число."""
        if not organization_ids:
            return {}
        rows = await self._db.execute(
            select(AthleteProfileModel.organization_id, func.count())
            .where(AthleteProfileModel.organization_id.in_(organization_ids))
            .group_by(AthleteProfileModel.organization_id)
        )
        return {organization_id: count for organization_id, count in rows.tuples() if organization_id is not None}

    async def add(self, item: OrganizationModel) -> OrganizationModel:
        """Добавляет организацию и возвращает её с id."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def flush(self) -> None:
        """Отправляет накопленные изменения в БД."""
        await self._db.flush()

    async def refresh(self, item: OrganizationModel) -> OrganizationModel:
        """Перечитывает организацию из БД."""
        await self._db.refresh(item)
        return item
