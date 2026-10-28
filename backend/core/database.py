from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True, hide_parameters=True)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


class UnitOfWork:
    """Обёртка над сессией для коммита и отката транзакции."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def commit(self) -> None:
        """Подтверждает транзакцию."""
        await self._db.commit()

    async def rollback(self) -> None:
        """Откатывает транзакцию."""
        await self._db.rollback()


async def get_db() -> AsyncIterator[AsyncSession]:
    """Открывает сессию БД на время запроса и отдаёт её через Depends."""
    async with session_factory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]
