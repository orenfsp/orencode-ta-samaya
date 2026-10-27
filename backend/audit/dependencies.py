from audit.domain.audit import Audit
from audit.repositories.pg_audit_log import AuditLogRepository
from core.database import DbSession


def get_audit(db: DbSession) -> Audit:
    return Audit(AuditLogRepository(db))
