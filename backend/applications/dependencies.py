from typing import Annotated

from fastapi import Depends

from applications.domain.applications import Applications
from applications.repositories.pg_application_members import ApplicationMemberRepository
from applications.repositories.pg_applications import ApplicationRepository
from audit.dependencies import get_audit
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.database import DbSession, UnitOfWork
from dictionaries.dependencies import DictionaryDep
from notifications.dependencies import NotificationsDep


def get_applications(
    db: DbSession,
    dictionary: DictionaryDep,
    audit: Annotated[Audit, Depends(get_audit)],
    notifications: NotificationsDep,
) -> Applications:
    """Собирает домен заявок на участие со всеми его зависимостями."""
    return Applications(
        uow=UnitOfWork(db),
        applications=ApplicationRepository(db),
        members=ApplicationMemberRepository(db),
        contests=ContestRepository(db),
        dictionary=dictionary,
        audit=audit,
        notifications=notifications,
    )


ApplicationsDep = Annotated[Applications, Depends(get_applications)]
