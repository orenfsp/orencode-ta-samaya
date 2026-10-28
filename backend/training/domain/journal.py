from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import NotFound, ValidationFailed
from files.domain.files import Files
from infrastructure.enums import SessionFormat
from infrastructure.training.session_attendance import SessionAttendanceModel
from infrastructure.training.training_group import TrainingGroupModel
from infrastructure.training.training_session import TrainingSessionModel
from training.domain.access import Access, today
from training.repositories.pg_groups import GroupRepository


@dataclass(frozen=True, slots=True)
class SessionChange:
    held_on: date
    topic: str
    format: SessionFormat
    proof_url: str | None
    proof_file_id: UUID | None
    note: str | None
    attendance: dict[UUID, bool]


@dataclass(frozen=True, slots=True)
class Attendance:
    sessions: Sequence[TrainingSessionModel]
    groups: dict[int, TrainingGroupModel]
    attended: int
    total: int


class Journal:
    """Журнал учебно-тренировочных занятий группы: тема, формат, подтверждение и посещаемость."""

    def __init__(self, uow: UnitOfWork, groups: GroupRepository, files: Files, access: Access, audit: Audit) -> None:
        """Сохраняет зависимости."""
        self._uow, self._groups, self._files, self._access, self._audit = uow, groups, files, access, audit

    async def sessions(
        self, actor_id: UUID, is_federation: bool, group_id: int, since: date | None, until: date | None
    ) -> tuple[TrainingGroupModel, Sequence[TrainingSessionModel]]:
        """Возвращает группу и её занятия за период."""
        group = await self._group(group_id)
        self._access.group(actor_id, is_federation, group)
        return group, await self._groups.sessions(group_id, since, until)

    async def create(
        self, actor_id: UUID, is_federation: bool, group_id: int, change: SessionChange, ip: str | None
    ) -> TrainingSessionModel:
        """Записывает занятие в журнал вместе с отметками посещения."""
        group = await self._group(group_id)
        self._access.group(actor_id, is_federation, group)
        await self._check(actor_id, is_federation, group, change, None)
        item = TrainingSessionModel(
            group_id=group.id, held_on=change.held_on, topic=change.topic, format=change.format,
            proof_url=change.proof_url, proof_file_id=change.proof_file_id, note=change.note, created_by=actor_id,
            attendance=[SessionAttendanceModel(athlete_id=athlete_id, present=present)
                        for athlete_id, present in change.attendance.items()],
        )
        self._groups.add(item)
        await self._groups.flush()
        await self._audit.write(AuditAction.TRAINING_SESSION_SAVE, actor_id, "training_session", item.id, {
            "group_id": group.id, "held_on": change.held_on.isoformat(), "format": change.format.value,
            "present": sum(change.attendance.values()),
        }, ip)
        await self._uow.commit()
        await self._groups.refresh(item)
        return item

    async def update(
        self, actor_id: UUID, is_federation: bool, session_id: UUID, change: SessionChange, ip: str | None
    ) -> TrainingSessionModel:
        """Правит занятие и заменяет отметки посещения."""
        item = await self._session(session_id)
        group = await self._group(item.group_id)
        self._access.group(actor_id, is_federation, group)
        await self._check(actor_id, is_federation, group, change, item.proof_file_id)
        item.held_on, item.topic, item.format, item.note = change.held_on, change.topic, change.format, change.note
        item.proof_url, item.proof_file_id = change.proof_url, change.proof_file_id
        item.attendance = [SessionAttendanceModel(athlete_id=athlete_id, present=present)
                           for athlete_id, present in change.attendance.items()]
        await self._groups.flush()
        await self._audit.write(AuditAction.TRAINING_SESSION_SAVE, actor_id, "training_session", item.id, {
            "group_id": group.id, "held_on": change.held_on.isoformat(), "format": change.format.value,
            "present": sum(change.attendance.values()), "update": True,
        }, ip)
        await self._uow.commit()
        await self._groups.refresh(item)
        return item

    async def remove(self, actor_id: UUID, is_federation: bool, session_id: UUID, ip: str | None) -> None:
        """Удаляет занятие из журнала."""
        item = await self._session(session_id)
        group = await self._group(item.group_id)
        self._access.group(actor_id, is_federation, group)
        await self._audit.write(AuditAction.TRAINING_SESSION_REMOVE, actor_id, "training_session", item.id,
                                {"group_id": group.id, "held_on": item.held_on.isoformat(), "topic": item.topic}, ip)
        await self._groups.remove(item)
        await self._uow.commit()

    async def attendance(self, actor_id: UUID, is_federation: bool, athlete_id: UUID, days: int) -> Attendance:
        """Возвращает занятия групп спортсмена за последние дни и сколько из них он посетил."""
        await self._access.athlete(actor_id, is_federation, athlete_id)
        sessions = await self._groups.sessions_of_athlete(athlete_id, today() - timedelta(days=days))
        groups: dict[int, TrainingGroupModel] = {}
        for item in sessions:
            if item.group_id not in groups:
                groups[item.group_id] = await self._group(item.group_id)
        attended = sum(1 for item in sessions if any(mark.athlete_id == athlete_id and mark.present for mark in item.attendance))
        return Attendance(sessions=sessions, groups=groups, attended=attended, total=len(sessions))

    async def _check(
        self, actor_id: UUID, is_federation: bool, group: TrainingGroupModel, change: SessionChange,
        attached: UUID | None,
    ) -> None:
        """Проверяет дату, подтверждение онлайн-занятия и что отмечены только зачисленные на дату спортсмены."""
        errors: dict[str, list[str]] = {}
        if change.held_on > today():
            errors["held_on"] = ["Занятие ещё не прошло"]
        if not change.topic.strip():
            errors["topic"] = ["Укажите тему занятия"]
        if change.format == SessionFormat.ONLINE and not change.proof_url and change.proof_file_id is None:
            errors["proof_url"] = ["Для онлайн-занятия приложите ссылку на запись или лог платформы"]
        if change.proof_file_id is not None:
            _, error = await self._files.usable(
                [change.proof_file_id], actor_id, is_federation, Files.ALLOWED_TYPES, [attached] if attached else []
            )
            if error:
                errors["proof_file_id"] = [error if error != "type" else "Такой тип файла не подходит"]
        enrolled = {item.athlete_id for item in await self._groups.on_date(group.id, change.held_on)}
        if set(change.attendance) - enrolled:
            errors["attendance"] = ["Отмечать можно только спортсменов, зачисленных в группу на дату занятия"]
        if errors:
            raise ValidationFailed(fields=errors)

    async def _group(self, group_id: int) -> TrainingGroupModel:
        """Возвращает группу или бросает NotFound."""
        group = await self._groups.get(group_id)
        if group is None:
            raise NotFound("Группа не найдена")
        return group

    async def _session(self, session_id: UUID) -> TrainingSessionModel:
        """Возвращает занятие или бросает NotFound."""
        item = await self._groups.session(session_id)
        if item is None:
            raise NotFound("Занятие не найдено")
        return item
