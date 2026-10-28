from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from contests.repositories.pg_contests import ContestRepository
from core.config import settings
from core.database import DbSession, UnitOfWork, session_factory
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.dependencies import get_files
from files.domain.files import Files
from notifications.dependencies import NotificationsDep, get_notifications
from notifications.domain.notifications import Notifications
from qualifications.domain.deadline_watcher import DeadlineWatcher
from qualifications.domain.judge_documents import JudgeDocuments
from qualifications.domain.judges import Judges
from qualifications.domain.qualifications import Qualifications
from qualifications.repositories.pg_judge_assignments import JudgeAssignmentRepository
from qualifications.repositories.pg_judge_documents import JudgeDocumentRepository
from qualifications.repositories.pg_qualifications import QualificationRepository


def get_qualifications(
    db: DbSession,
    audit: Annotated[Audit, Depends(get_audit)],
    files: Annotated[Files, Depends(get_files)],
    notifications: NotificationsDep,
) -> Qualifications:
    """Собирает сервис разрядов и категорий с нужными зависимостями."""
    return Qualifications(UnitOfWork(db), QualificationRepository(db), UserRepository(db), DictionaryRepository(db),
                          files, audit, notifications, settings.document_signing_secret.get_secret_value())


def get_judges(db: DbSession, audit: Annotated[Audit, Depends(get_audit)], notifications: NotificationsDep) -> Judges:
    """Собирает сервис судейских коллегий с нужными зависимостями."""
    return Judges(UnitOfWork(db), JudgeAssignmentRepository(db), QualificationRepository(db), ContestRepository(db),
                  UserRepository(db), DictionaryRepository(db), audit, notifications)


def get_judge_documents(
    db: DbSession, audit: Annotated[Audit, Depends(get_audit)], files: Annotated[Files, Depends(get_files)]
) -> JudgeDocuments:
    """Собирает сервис документов судей к протоколу с нужными зависимостями."""
    return JudgeDocuments(UnitOfWork(db), JudgeDocumentRepository(db), JudgeAssignmentRepository(db),
                          ContestRepository(db), files, audit)


def _notifications(db: AsyncSession) -> Notifications:
    """Собирает сервис уведомлений на переданной сессии БД."""
    return get_notifications(db)


def deadline_watcher() -> DeadlineWatcher:
    """Создаёт фоновый сторож напоминаний об истекающих сроках разрядов и категорий."""
    return DeadlineWatcher(session_factory, _notifications, settings)


QualificationsDep = Annotated[Qualifications, Depends(get_qualifications)]
JudgesDep = Annotated[Judges, Depends(get_judges)]
JudgeDocumentsDep = Annotated[JudgeDocuments, Depends(get_judge_documents)]
