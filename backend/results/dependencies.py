from typing import Annotated

from fastapi import Depends

from applications.repositories.pg_applications import ApplicationRepository
from audit.dependencies import get_audit
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.database import DbSession, UnitOfWork
from documents.dependencies import get_documents
from files.dependencies import object_storage
from notifications.dependencies import NotificationsDep
from results.domain.results import Results
from results.repositories.pg_results import ResultRepository


def get_results(
    db: DbSession,
    audit: Annotated[Audit, Depends(get_audit)],
    notifications: NotificationsDep,
) -> Results:
    """Собирает домен результатов соревнований со всеми его зависимостями."""
    return Results(
        uow=UnitOfWork(db),
        results=ResultRepository(db),
        applications=ApplicationRepository(db),
        contests=ContestRepository(db),
        audit=audit,
        notifications=notifications,
        documents=get_documents(db, audit),
        storage=object_storage,
    )


ResultsDep = Annotated[Results, Depends(get_results)]
