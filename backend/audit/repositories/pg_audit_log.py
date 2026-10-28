from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.services.audit_log import AuditLogModel
from infrastructure.account.user import UserModel


class AuditLogRepository:
    """Чтение и запись строк журнала действий в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def list(
        self,
        q: str | None,
        user_id: UUID | None,
        action: str | None,
        object_type: str | None,
        start: datetime | None,
        end: datetime | None,
        limit: int,
        offset: int,
        oldest_first: bool = False,
    ) -> tuple[list[tuple[AuditLogModel, UserModel | None]], int]:
        """Возвращает страницу записей журнала с автором по фильтрам и их общее число."""
        filters: list[Any] = []
        if q:
            name = func.concat_ws(" ", UserModel.last_name, UserModel.first_name, UserModel.middle_name)
            filters.append(or_(UserModel.email.icontains(q, autoescape=True), name.icontains(q, autoescape=True)))
        if user_id is not None:
            filters.append(AuditLogModel.user_id == user_id)
        if action:
            filters.append(AuditLogModel.action == action)
        if object_type:
            filters.append(AuditLogModel.object_type == object_type)
        if start:
            filters.append(AuditLogModel.created_at >= start)
        if end:
            filters.append(AuditLogModel.created_at < end)
        joined = select(AuditLogModel, UserModel).outerjoin(UserModel, UserModel.id == AuditLogModel.user_id)
        total = await self._db.scalar(select(func.count()).select_from(joined.where(*filters).subquery()))
        rows = await self._db.execute(
            joined.where(*filters)
            .order_by(
                *(
                    (AuditLogModel.created_at.asc(), AuditLogModel.id.asc())
                    if oldest_first
                    else (AuditLogModel.created_at.desc(), AuditLogModel.id.desc())
                )
            )
            .limit(limit)
            .offset(offset)
        )
        return [(row[0], row[1]) for row in rows], total or 0

    async def add(
        self,
        action: str,
        user_id: UUID | None,
        object_type: str | None,
        object_id: UUID | None,
        payload: dict[str, Any],
        ip: str | None,
    ) -> None:
        """Добавляет новую запись в журнал действий."""
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
