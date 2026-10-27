from typing import Any
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.repositories.pg_audit_log import AuditLogRepository


class Audit:
    def __init__(self, repository: AuditLogRepository) -> None:
        self._repository = repository

    async def write(
        self,
        action: AuditAction,
        user_id: UUID | None = None,
        object_type: str | None = None,
        object_id: UUID | None = None,
        payload: dict[str, Any] | None = None,
        ip: str | None = None,
    ) -> None:
        await self._repository.add(
            action=action.value,
            user_id=user_id,
            object_type=object_type,
            object_id=object_id,
            payload=payload or {},
            ip=ip,
        )
