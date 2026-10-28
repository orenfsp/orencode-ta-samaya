from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from contests.domain.contests import Contest
from contests.repositories.pg_contests import ContestRepository
from core.database import DbSession, UnitOfWork
from dictionaries.dependencies import DictionaryDep
from files.dependencies import FilesDep
from notifications.dependencies import NotificationsDep


def get_contest(
    db: DbSession,
    dictionary: DictionaryDep,
    files: FilesDep,
    audit: Annotated[Audit, Depends(get_audit)],
    notifications: NotificationsDep,
) -> Contest:
    """Собирает домен соревнований со всеми его зависимостями."""
    return Contest(
        uow=UnitOfWork(db),
        contests=ContestRepository(db),
        users=UserRepository(db),
        dictionary=dictionary,
        files=files,
        audit=audit,
        notifications=notifications,
    )


ContestDep = Annotated[Contest, Depends(get_contest)]
