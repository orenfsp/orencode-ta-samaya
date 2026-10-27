from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


class UnitOfWork:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def commit(self) -> None:
        await self._db.commit()

    async def rollback(self) -> None:
        await self._db.rollback()


async def get_db() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]
