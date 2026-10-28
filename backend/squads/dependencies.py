from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.config import settings
from core.database import DbSession, UnitOfWork
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.dependencies import get_files
from files.domain.files import Files
from notifications.dependencies import NotificationsDep
from ratings.dependencies import RatingsDep
from squads.domain.squads import Squads
from squads.repositories.pg_squads import SquadRepository


def get_squads(
    db: DbSession,
    ratings: RatingsDep,
    audit: Annotated[Audit, Depends(get_audit)],
    files: Annotated[Files, Depends(get_files)],
    notifications: NotificationsDep,
) -> Squads:
    """Собирает домен сборных команд со всеми его зависимостями."""
    return Squads(UnitOfWork(db), SquadRepository(db), DictionaryRepository(db), ratings, files, audit, notifications,
                  settings)


SquadsDep = Annotated[Squads, Depends(get_squads)]
