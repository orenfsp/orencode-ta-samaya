import re
from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.repositories.pg_audit_log import AuditLogRepository
from core.errors import ValidationFailed
from infrastructure.services.audit_log import AuditLogModel
from infrastructure.account.user import UserModel

SECRETS = ("password", "token", "secret", "authorization", "cookie", "пароль")


class Audit:
    """Запись и чтение журнала действий пользователей."""

    def __init__(self, repository: AuditLogRepository, objects: dict[str, str]) -> None:
        """Сохраняет репозиторий и словарь названий типов объектов."""
        self._repository = repository
        self._objects = objects

    async def write(
        self,
        action: AuditAction,
        user_id: UUID | None = None,
        object_type: str | None = None,
        object_id: UUID | None = None,
        payload: dict[str, Any] | None = None,
        ip: str | None = None,
    ) -> None:
        """Пишет в журнал новую запись о действии пользователя."""
        await self._repository.add(
            action=action.value,
            user_id=user_id,
            object_type=object_type,
            object_id=object_id,
            payload=payload or {},
            ip=ip,
        )

    async def list(
        self,
        q: str | None,
        user_id: UUID | None,
        action: str | None,
        object_type: str | None,
        date_from: date | None,
        date_to: date | None,
        limit: int,
        offset: int,
        oldest_first: bool = False,
    ) -> tuple[list[tuple[AuditLogModel, UserModel | None]], int]:
        """Возвращает страницу записей журнала по фильтрам и их общее количество."""
        if date_from and date_to and date_from > date_to:
            raise ValidationFailed(fields={"date_to": ["Дата окончания раньше даты начала"]})
        if date_to == date.max:
            raise ValidationFailed(fields={"date_to": ["Дата вне допустимого диапазона"]})
        zone = ZoneInfo("Asia/Yekaterinburg")
        start = datetime.combine(date_from, time.min, zone) if date_from else None
        end = datetime.combine(date_to + timedelta(days=1), time.min, zone) if date_to else None
        return await self._repository.list(q, user_id, action, object_type, start, end, limit, offset, oldest_first)

    def catalog(self) -> tuple[tuple[tuple[str, str], ...], tuple[tuple[str, str], ...]]:
        """Отдаёт список всех действий и объектов с их названиями для фильтров."""
        actions = tuple((item.value, item.label) for item in AuditAction)
        objects = tuple(sorted(self._objects.items(), key=lambda pair: pair[1]))
        return actions, objects

    def object_label(self, object_type: str | None) -> str | None:
        """Возвращает русское название типа объекта или сам код, если название не найдено."""
        return self._objects.get(object_type, object_type) if object_type else None

    @classmethod
    def safe_payload(cls, value: Any) -> Any:
        """Рекурсивно вычищает секреты (пароли, токены) из значения перед показом в журнале."""
        if isinstance(value, dict):
            return {key: cls.safe_payload(item) for key, item in value.items()
                    if not any(secret in str(key).lower() for secret in SECRETS)}
        if isinstance(value, list):
            return [cls.safe_payload(item) for item in value]
        if isinstance(value, str):
            return re.sub(r"(?i)((?:token|password|secret|authorization)=)[^&\s]+", r"\1[скрыто]", value)
        return value
