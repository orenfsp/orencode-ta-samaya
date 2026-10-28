from audit.domain.actions import AUDIT_OBJECTS
from audit.domain.audit import Audit
from audit.repositories.pg_audit_log import AuditLogRepository
from core.database import DbSession
from dictionaries.domain.dictionaries import Dictionary

OBJECTS = AUDIT_OBJECTS | {key: f"Справочник «{title}»" for key, title in Dictionary.catalog()}


def get_audit(db: DbSession) -> Audit:
    """Собирает домен журнала действий для FastAPI Depends."""
    return Audit(AuditLogRepository(db), OBJECTS)
