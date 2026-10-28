from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.database import DbSession, UnitOfWork
from dictionaries.dependencies import DictionaryDep
from ratings.domain.ratings import Ratings
from ratings.repositories.pg_ratings import RatingRepository


def get_ratings(db: DbSession, dictionary: DictionaryDep, audit: Annotated[Audit, Depends(get_audit)]) -> Ratings:
    """Собирает домен рейтингов со всеми его зависимостями."""
    return Ratings(RatingRepository(db), dictionary, UnitOfWork(db), audit)


RatingsDep = Annotated[Ratings, Depends(get_ratings)]
