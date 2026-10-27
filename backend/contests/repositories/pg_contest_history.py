from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contest_status_history import ContestStatusHistoryModel


class ContestHistoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add(
        self,
        contest_id: int,
        kind: str,
        from_value: str | None,
        to_value: str,
        user_id: UUID | None,
        comment: str | None = None,
    ) -> None:
        self._db.add(
            ContestStatusHistoryModel(
                contest_id=contest_id,
                kind=kind,
                from_value=from_value,
                to_value=to_value,
                user_id=user_id,
                comment=comment,
            )
        )
        await self._db.flush()

    async def list(self, contest_id: int) -> Sequence[ContestStatusHistoryModel]:
        items = await self._db.scalars(
            select(ContestStatusHistoryModel)
            .where(ContestStatusHistoryModel.contest_id == contest_id)
            .order_by(ContestStatusHistoryModel.created_at, ContestStatusHistoryModel.id)
        )
        return items.all()
