from typing import Annotated

from fastapi import Depends

from core.database import DbSession
from dictionaries.dependencies import DictionaryDep
from ratings.domain.ratings import Ratings
from ratings.repositories.pg_ratings import RatingRepository


def get_ratings(db: DbSession, dictionary: DictionaryDep) -> Ratings:
    """Собирает домен рейтингов со всеми его зависимостями."""
    return Ratings(RatingRepository(db), dictionary)


RatingsDep = Annotated[Ratings, Depends(get_ratings)]
