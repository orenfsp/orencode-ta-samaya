from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.database import DbSession, UnitOfWork
from dictionaries.domain.dictionaries import Dictionary
from dictionaries.repositories.pg_dictionaries import DictionaryRepository


def get_dictionary(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Dictionary:
    return Dictionary(UnitOfWork(db), DictionaryRepository(db), audit)


DictionaryDep = Annotated[Dictionary, Depends(get_dictionary)]
