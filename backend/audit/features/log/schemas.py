from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from audit.domain.actions import ACTION_LABELS
from audit.domain.audit import Audit
from infrastructure.services.audit_log import AuditLogModel
from infrastructure.account.user import UserModel


class ActorOut(BaseModel):
    id: UUID
    full_name: str
    email: str


class AuditOut(BaseModel):
    id: UUID
    created_at: datetime
    user: ActorOut | None
    action: str
    action_label: str
    object_type: str | None
    object_label: str | None
    object_id: UUID | None
    payload: dict[str, Any]
    ip: str | None

    @classmethod
    def from_row(cls, item: AuditLogModel, user: UserModel | None, object_label: str | None) -> "AuditOut":
        """Строит схему ответа из строки журнала и связанного пользователя."""
        actor = None
        if user is not None:
            name = " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)
            actor = ActorOut(id=user.id, full_name=name, email=user.email)
        return cls(
            id=item.id,
            created_at=item.created_at,
            user=actor,
            action=item.action,
            action_label=ACTION_LABELS.get(item.action, item.action),
            object_type=item.object_type,
            object_label=object_label,
            object_id=item.object_id,
            payload=Audit.safe_payload(item.payload),
            ip=item.ip,
        )


class AuditPage(BaseModel):
    items: list[AuditOut]
    total: int


class CatalogEntry(BaseModel):
    code: str
    label: str


class CatalogOut(BaseModel):
    actions: list[CatalogEntry]
    objects: list[CatalogEntry]
