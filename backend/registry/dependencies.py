from typing import Annotated

from fastapi import Depends

from core.database import DbSession
from registry.domain.registry import Registry
from registry.repositories.pg_registry import RegistryRepository


def get_registry(db: DbSession) -> Registry:
    """Собирает сервис реестра для запроса."""
    return Registry(RegistryRepository(db))


RegistryDep = Annotated[Registry, Depends(get_registry)]
