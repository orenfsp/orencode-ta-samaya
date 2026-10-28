from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.user import UserModel

U = UserModel


class CodeforcesRepository:
    """Доступ к хэндлам и рейтингам Codeforces пользователей."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def user(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id."""
        return await self._db.scalar(select(U).where(U.id == user_id).execution_options(populate_existing=True))

    async def handles(self) -> Sequence[str]:
        """Возвращает все привязанные хэндлы Codeforces без повторов."""
        rows = await self._db.scalars(select(U.codeforces_handle).where(U.codeforces_handle.is_not(None)).distinct())
        return [row for row in rows.all() if row]

    async def set_user(self, user_id: UUID, values: dict[str, Any]) -> None:
        """Обновляет поля пользователя по id."""
        await self._db.execute(update(U).where(U.id == user_id).values(**values))

    async def set_handle(self, handle: str, values: dict[str, Any]) -> None:
        """Обновляет поля пользователя, у которого привязан данный хэндл."""
        await self._db.execute(update(U).where(U.codeforces_handle == handle).values(**values))
