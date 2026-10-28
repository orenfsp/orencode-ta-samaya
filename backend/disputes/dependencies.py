from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.database import DbSession, UnitOfWork
from disputes.domain.disputes import Disputes
from disputes.repositories.pg_disputes import DisputeRepository
from files.dependencies import get_files
from files.domain.files import Files
from notifications.dependencies import NotificationsDep
from results.dependencies import get_results
from results.domain.results import Results


def get_disputes(
    db: DbSession,
    audit: Annotated[Audit, Depends(get_audit)],
    files: Annotated[Files, Depends(get_files)],
    results: Annotated[Results, Depends(get_results)],
    notifications: NotificationsDep,
) -> Disputes:
    """Собирает домен апелляций и нарушений для запроса."""
    return Disputes(UnitOfWork(db), DisputeRepository(db), files, results, audit, notifications)


DisputesDep = Annotated[Disputes, Depends(get_disputes)]
