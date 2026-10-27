from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.audit_log import AuditLogModel


class AuditLogRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add(
        self,
        action: str,
        user_id: UUID | None,
        object_type: str | None,
        object_id: UUID | None,
        payload: dict[str, Any],
        ip: str | None,
    ) -> None:
        self._db.add(
            AuditLogModel(
                action=action,
                user_id=user_id,
                object_type=object_type,
                object_id=object_id,
                payload=payload,
                ip=ip,
            )
        )
        await self._db.flush()
