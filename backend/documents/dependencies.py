from typing import Annotated

from fastapi import Depends

from applications.repositories.pg_applications import ApplicationRepository
from audit.dependencies import get_audit
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.config import settings
from core.database import DbSession, UnitOfWork
from documents.domain.documents import Documents
from documents.repositories.pg_documents import DocumentRepository
from qualifications.repositories.pg_qualifications import QualificationRepository
from results.repositories.pg_results import ResultRepository


def get_documents(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Documents:
    """Собирает сервис документов с нужными зависимостями."""
    return Documents(
        uow=UnitOfWork(db),
        documents=DocumentRepository(db),
        contests=ContestRepository(db),
        applications=ApplicationRepository(db),
        results=ResultRepository(db),
        qualifications=QualificationRepository(db),
        audit=audit,
        settings=settings,
    )


DocumentsDep = Annotated[Documents, Depends(get_documents)]
