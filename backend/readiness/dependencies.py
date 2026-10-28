from typing import Annotated

from fastapi import Depends

from core.database import DbSession
from readiness.domain.readiness import Readiness
from readiness.repositories.pg_readiness import ReadinessRepository


def get_readiness(db: DbSession) -> Readiness:
    """Собирает сервис готовности соревнования для запроса."""
    return Readiness(ReadinessRepository(db))


ReadinessDep = Annotated[Readiness, Depends(get_readiness)]
