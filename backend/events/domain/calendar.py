from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from contests.domain.contests import Contest
from contests.repositories.pg_contests import ContestQuery
from core.database import UnitOfWork
from core.errors import InvalidStatus, NotFound, ValidationFailed
from events.repositories.pg_calendar import CalendarRepository
from infrastructure.content.calendar_event import ORENBURG, CalendarEventModel, local_date
from infrastructure.contests.contest import ContestModel

CalendarItem = CalendarEventModel | ContestModel


def _starts(item: CalendarItem) -> date:
    """Возвращает дату начала события или соревнования в орбургском времени."""
    return local_date(item.starts_at) if isinstance(item, CalendarEventModel) else item.starts_on


class Calendar:
    """Объединённая лента событий календаря и соревнований, их CRUD и переходы статусов."""

    MAX_CONTESTS = 1000

    def __init__(
        self, repository: CalendarRepository, contests: Contest, uow: UnitOfWork, audit: Audit
    ) -> None:
        """Сохраняет зависимости."""
        self._repository = repository
        self._contests = contests
        self._uow = uow
        self._audit = audit

    async def feed(
        self, start: date, end: date, kind: str | None, q: str, limit: int, offset: int
    ) -> tuple[list[CalendarItem], int]:
        """Возвращает опубликованные события и/или соревнования за период с пагинацией."""
        if end < start or (end - start).days > 366 or start.year < 1900 or end.year > 2100:
            raise ValidationFailed(fields={"date_to": ["Выберите период до 367 дней, окончание не раньше начала"]})
        items: list[CalendarItem] = []
        if kind in (None, "event"):
            before = datetime.combine(end + timedelta(days=1), time(), ORENBURG)
            items.extend(await self._repository.published(before, datetime.combine(start, time(), ORENBURG), q))
        if kind in (None, "contest"):
            contests, _ = await self._contests.list_public(
                ContestQuery(date_from=start, date_to=end, search=q or None), self.MAX_CONTESTS, 0
            )
            items.extend(contests)
        items.sort(key=lambda item: (_starts(item), item.title))
        return items[offset : offset + limit], len(items)

    async def get(self, event_id: UUID) -> CalendarEventModel:
        """Возвращает опубликованное событие или 404, если его нет либо оно не опубликовано."""
        event = await self._repository.get(event_id)
        if event is None or event.status != "published":
            raise NotFound()
        return event

    async def admin_get(self, event_id: UUID) -> CalendarEventModel:
        """Возвращает событие по id в любом статусе для админки; 404, если не найдено."""
        event = await self._repository.get(event_id)
        if event is None:
            raise NotFound()
        return event

    async def admin_list(self, q: str, limit: int, offset: int) -> tuple[list[CalendarEventModel], int]:
        """Возвращает страницу событий для админки с поиском по названию."""
        return await self._repository.list(q, limit, offset)

    async def create(self, values: dict[str, Any], actor: UUID, ip: str | None) -> CalendarEventModel:
        """Создаёт событие в статусе «draft» и пишет это в журнал действий."""
        event = await self._repository.create({**values, "status": "draft", "created_by": actor})
        await self._record(AuditAction.CALENDAR_CREATE, event, actor, ip)
        return event

    async def update(self, event_id: UUID, values: dict[str, Any], actor: UUID, ip: str | None) -> CalendarEventModel:
        """Обновляет поля события с проверкой дат и места; архивное событие менять нельзя."""
        event = await self._editable(event_id)
        if event.status == "archived":
            raise InvalidStatus()
        if values.get("ends_at", event.ends_at) <= values.get("starts_at", event.starts_at):
            raise ValidationFailed(fields={"ends_at": ["Окончание должно быть позже начала"]})
        if not values.get("is_online", event.is_online) and not (values.get("location", event.location) or "").strip():
            raise ValidationFailed(fields={"location": ["Укажите место или выберите онлайн-формат"]})
        for key, value in values.items():
            setattr(event, key, value)
        event.updated_at = datetime.now(UTC)
        await self._record(AuditAction.CALENDAR_UPDATE, event, actor, ip)
        return event

    async def transition(self, event_id: UUID, action: str, actor: UUID, ip: str | None) -> CalendarEventModel:
        """Переводит событие между draft/published/archived с проверкой текущего статуса."""
        event = await self._editable(event_id)
        transitions = {
            "publish": ("draft", "published", AuditAction.CALENDAR_PUBLISH),
            "unpublish": ("published", "draft", AuditAction.CALENDAR_UNPUBLISH),
        }
        if action == "archive":
            if event.status == "archived":
                raise InvalidStatus()
            target, audit_action = "archived", AuditAction.CALENDAR_ARCHIVE
        else:
            previous, target, audit_action = transitions[action]
            if event.status != previous:
                raise InvalidStatus()
        event.status = target
        event.updated_at = datetime.now(UTC)
        await self._record(audit_action, event, actor, ip)
        return event

    async def _editable(self, event_id: UUID) -> CalendarEventModel:
        """Блокирует и возвращает событие для изменения; 404, если его нет."""
        event = await self._repository.get(event_id, lock=True)
        if event is None:
            raise NotFound()
        return event

    async def _record(self, action: AuditAction, event: CalendarEventModel, actor: UUID, ip: str | None) -> None:
        """Сбрасывает изменения в БД, пишет запись в журнал и коммитит транзакцию."""
        await self._repository.flush()
        await self._audit.write(
            action,
            user_id=actor,
            object_type="calendar_event",
            object_id=event.id,
            payload={"title": event.title, "status": event.status},
            ip=ip,
        )
        await self._uow.commit()
