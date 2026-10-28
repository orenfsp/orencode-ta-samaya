from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from consents.domain.consents import Consents
from consents.repositories.pg_consents import ConsentRepository
from core.database import DbSession, UnitOfWork
from files.dependencies import FilesDep
from notifications.dependencies import NotificationsDep


def get_consents(
    db: DbSession, files: FilesDep, audit: Annotated[Audit, Depends(get_audit)], notifications: NotificationsDep
) -> Consents:
    """Собирает домен согласий со всеми его зависимостями."""
    return Consents(
        uow=UnitOfWork(db), consents=ConsentRepository(db), files=files, audit=audit, notifications=notifications
    )


ConsentsDep = Annotated[Consents, Depends(get_consents)]
