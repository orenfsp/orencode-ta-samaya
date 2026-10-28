from collections.abc import Sequence
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.enums import TrainingStage
from infrastructure.training.group_enrollment import GroupEnrollmentModel
from infrastructure.training.training_group import TrainingGroupModel
from infrastructure.training.training_session import TrainingSessionModel

G, E, S = TrainingGroupModel, GroupEnrollmentModel, TrainingSessionModel


class GroupRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def search(
        self,
        organization_id: int | None,
        coach_id: UUID | None,
        discipline_id: int | None,
        stage: TrainingStage | None,
        active_only: bool,
    ) -> Sequence[TrainingGroupModel]:
        """Возвращает группы по фильтрам, по организации и названию."""
        conditions: list[Any] = []
        if organization_id is not None:
            conditions.append(G.organization_id == organization_id)
        if coach_id is not None:
            conditions.append(G.coach_id == coach_id)
        if discipline_id is not None:
            conditions.append(G.discipline_id == discipline_id)
        if stage is not None:
            conditions.append(G.stage == stage)
        if active_only:
            conditions.append(G.is_active.is_(True))
        return (await self._db.scalars(select(G).where(*conditions).order_by(G.organization_id, G.stage, G.name))).all()

    async def get(self, group_id: int, lock: bool = False) -> TrainingGroupModel | None:
        """Возвращает группу по id или None; lock — с блокировкой строки."""
        return await self._db.get(G, group_id, with_for_update=lock)

    async def by_name(self, organization_id: int, name: str) -> TrainingGroupModel | None:
        """Возвращает группу организации по названию без учёта регистра или None."""
        query = select(G).where(G.organization_id == organization_id, func.lower(G.name) == name.strip().lower())
        return await self._db.scalar(query)

    async def sizes(self, group_ids: Sequence[int]) -> dict[int, int]:
        """Считает спортсменов, зачисленных сейчас: группа → число."""
        if not group_ids:
            return {}
        rows = await self._db.execute(
            select(E.group_id, func.count()).where(E.group_id.in_(group_ids), E.valid_to.is_(None)).group_by(E.group_id)
        )
        return {group_id: count for group_id, count in rows.tuples()}

    async def enrollments(self, group_id: int) -> Sequence[GroupEnrollmentModel]:
        """Возвращает все зачисления группы: текущие и закрытые, новые первыми."""
        query = select(E).where(E.group_id == group_id).order_by(E.valid_to.is_not(None), E.valid_from.desc())
        return (await self._db.scalars(query)).all()

    async def enrollment(self, enrollment_id: UUID) -> GroupEnrollmentModel | None:
        """Возвращает зачисление по id или None."""
        return await self._db.get(E, enrollment_id)

    async def open_enrollment(self, group_id: int, athlete_id: UUID) -> GroupEnrollmentModel | None:
        """Возвращает текущее зачисление спортсмена в группу или None."""
        return await self._db.scalar(select(E).where(E.group_id == group_id, E.athlete_id == athlete_id, E.valid_to.is_(None)))

    async def open_in_discipline(self, athlete_id: UUID, discipline_id: int) -> GroupEnrollmentModel | None:
        """Возвращает текущее зачисление спортсмена в любую группу дисциплины или None."""
        query = select(E).join(G, G.id == E.group_id).where(
            E.athlete_id == athlete_id, E.valid_to.is_(None), G.discipline_id == discipline_id
        )
        return await self._db.scalar(query)

    async def of_athlete(self, athlete_id: UUID) -> Sequence[GroupEnrollmentModel]:
        """Возвращает историю зачислений спортсмена, новые первыми."""
        query = select(E).where(E.athlete_id == athlete_id).order_by(E.valid_from.desc(), E.created_at.desc())
        return (await self._db.scalars(query)).all()

    async def all_enrollments(self) -> Sequence[GroupEnrollmentModel]:
        """Возвращает все зачисления всех групп."""
        return (await self._db.scalars(select(E))).all()

    async def athlete_coaches(self, athlete_id: UUID) -> Sequence[UUID]:
        """Возвращает тренеров групп, где спортсмен сейчас занимается."""
        query = select(G.coach_id).join(E, E.group_id == G.id).where(E.athlete_id == athlete_id, E.valid_to.is_(None))
        return (await self._db.scalars(query)).all()

    async def on_date(self, group_id: int, on: date) -> Sequence[GroupEnrollmentModel]:
        """Возвращает зачисления, действовавшие в группе на дату."""
        query = select(E).where(
            E.group_id == group_id, E.valid_from <= on, or_(E.valid_to.is_(None), E.valid_to > on)
        )
        return (await self._db.scalars(query)).all()

    async def sessions(self, group_id: int, since: date | None, until: date | None) -> Sequence[TrainingSessionModel]:
        """Возвращает занятия группы за период, новые первыми."""
        conditions: list[Any] = [S.group_id == group_id]
        if since is not None:
            conditions.append(S.held_on >= since)
        if until is not None:
            conditions.append(S.held_on <= until)
        return (await self._db.scalars(select(S).where(*conditions).order_by(S.held_on.desc(), S.created_at.desc()))).all()

    async def session(self, session_id: UUID) -> TrainingSessionModel | None:
        """Возвращает занятие по id или None."""
        return await self._db.get(S, session_id)

    async def sessions_of_athlete(self, athlete_id: UUID, since: date) -> Sequence[TrainingSessionModel]:
        """Возвращает занятия групп спортсмена с даты, пока он был в них зачислен."""
        query = select(S).join(E, E.group_id == S.group_id).where(
            E.athlete_id == athlete_id, S.held_on >= since, S.held_on >= E.valid_from,
            or_(E.valid_to.is_(None), S.held_on < E.valid_to),
        )
        return (await self._db.scalars(query.order_by(S.held_on.desc()))).unique().all()

    def add(self, item: TrainingGroupModel | GroupEnrollmentModel | TrainingSessionModel) -> None:
        """Добавляет группу, зачисление или занятие."""
        self._db.add(item)

    async def remove(self, item: TrainingSessionModel) -> None:
        """Удаляет занятие вместе с отметками."""
        await self._db.delete(item)
        await self._db.flush()

    async def flush(self) -> None:
        """Отправляет накопленные изменения в БД."""
        await self._db.flush()

    async def refresh(self, item: object) -> None:
        """Перечитывает объект из БД."""
        await self._db.refresh(item)
