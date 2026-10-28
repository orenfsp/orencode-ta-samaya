from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.database import DbSession, UnitOfWork
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from evsk.domain.evsk import Evsk
from evsk.repositories.pg_evsk import EvskRepository


def get_evsk(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Evsk:
    """Собирает сервис правил ЕВСК для запроса."""
    return Evsk(UnitOfWork(db), EvskRepository(db), DictionaryRepository(db), audit)


EvskDep = Annotated[Evsk, Depends(get_evsk)]
