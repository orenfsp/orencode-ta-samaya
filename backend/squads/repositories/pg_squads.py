from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.squads.squad import SquadModel
from infrastructure.squads.squad_member import SquadMemberModel

S = SquadModel


class SquadRepository:
    """Доступ к сборным командам в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, squad_id: int) -> SquadModel | None:
        """Возвращает сборную по id."""
        return await self._db.get(S, squad_id)

    async def find(self, discipline_id: int, age_group_id: int | None, academic_group_id: int | None) -> SquadModel | None:
        """Возвращает действующую сборную по дисциплине и возрастной или академической группе."""
        query = select(S).where(S.discipline_id == discipline_id)
        if age_group_id is not None:
            query = query.where(S.age_group_id == age_group_id)
        else:
            query = query.where(S.academic_group_id == academic_group_id)
        return await self._db.scalar(query)

    async def list(
        self, discipline_id: int | None, age_group_id: int | None, academic_group_id: int | None, kind: str | None
    ) -> Sequence[SquadModel]:
        """Возвращает сборные по фильтру дисциплины, группы и вида группы."""
        query = select(S)
        if discipline_id is not None:
            query = query.where(S.discipline_id == discipline_id)
        if age_group_id is not None:
            query = query.where(S.age_group_id == age_group_id)
        if academic_group_id is not None:
            query = query.where(S.academic_group_id == academic_group_id)
        if kind == "age":
            query = query.where(S.age_group_id.is_not(None))
        elif kind == "academic":
            query = query.where(S.academic_group_id.is_not(None))
        return (await self._db.scalars(query.order_by(S.discipline_id, S.age_group_id, S.academic_group_id))).all()

    async def of_user(self, user_id: UUID) -> Sequence[SquadModel]:
        """Возвращает сборные, где пользователь состоит участником, новые утверждённые впереди."""
        query = (
            select(S)
            .join(SquadMemberModel, SquadMemberModel.squad_id == S.id)
            .where(SquadMemberModel.user_id == user_id)
            .order_by(S.approved_at.desc())
        )
        return (await self._db.scalars(query)).all()

    async def uses_file(self, file_id: UUID) -> bool:
        """Проверяет, используется ли файл как приказ какой-либо сборной."""
        return await self._db.scalar(select(S.id).where(S.order_file_id == file_id)) is not None

    async def add(self, item: SquadModel) -> SquadModel:
        """Добавляет новую сборную."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def remove(self, item: SquadModel) -> None:
        """Удаляет сборную."""
        await self._db.delete(item)
        await self._db.flush()
