from typing import Any
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.user import UserModel


def _fresh(statement: Select) -> Select:
    """Добавляет к запросу опцию обновления уже загруженных в сессии объектов."""
    return statement.execution_options(populate_existing=True)


class PersonRepository:
    """Доступ к пользователям для страниц профиля."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def user(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id."""
        return await self._db.scalar(_fresh(select(UserModel).where(UserModel.id == user_id)))

    async def update(self, item: UserModel, values: dict[str, Any]) -> UserModel:
        """Обновляет поля пользователя значениями values."""
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item
