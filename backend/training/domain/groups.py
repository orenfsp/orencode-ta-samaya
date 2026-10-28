from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import AppError, Forbidden, InvalidStatus, NameTaken, NotFound, ValidationFailed
from infrastructure.enums import TRAINING_STAGE_TITLES, EnrollmentEnd, Role, RoleStatus, TrainingStage
from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.sport.athlete_organization import AthleteOrganizationModel
from infrastructure.training.group_enrollment import GroupEnrollmentModel
from infrastructure.training.training_group import TrainingGroupModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T
from profiles.repositories.pg_organizations import OrganizationRepository
from profiles.repositories.pg_sport_profiles import SportProfileRepository
from training.domain.access import Access, full_name, today
from training.repositories.pg_groups import GroupRepository
from training.repositories.pg_programs import ProgramRepository


class AlreadyEnrolled(AppError):
    status_code = 409
    code = "already_enrolled"
    message = "Спортсмен уже занимается в группе по этой дисциплине. Оформите перевод"


@dataclass(frozen=True, slots=True)
class GroupFilter:
    organization_id: int | None = None
    coach_id: UUID | None = None
    discipline_id: int | None = None
    stage: TrainingStage | None = None
    active_only: bool = True


@dataclass(frozen=True, slots=True)
class GroupChange:
    organization_id: int | None = None
    discipline_id: int | None = None
    stage: TrainingStage | None = None
    coach_id: UUID | None = None
    name: str | None = None
    start_year: int | None = None
    is_active: bool | None = None


@dataclass(frozen=True, slots=True)
class Move:
    on: date
    order_number: str | None
    note: str | None


class Groups:
    """Учебно-тренировочные группы по этапам: создание, зачисление, перевод и отчисление с историей."""

    def __init__(
        self,
        uow: UnitOfWork,
        groups: GroupRepository,
        programs: ProgramRepository,
        organizations: OrganizationRepository,
        profiles: SportProfileRepository,
        users: UserRepository,
        access: Access,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._groups, self._programs, self._organizations = uow, groups, programs, organizations
        self._profiles, self._users, self._access = profiles, users, access
        self._audit, self._notifications = audit, notifications

    async def search(
        self, actor_id: UUID, is_federation: bool, query: GroupFilter
    ) -> tuple[Sequence[TrainingGroupModel], dict[int, int]]:
        """Ищет группы: федерация — все, тренер — только свои; возвращает группы и их численность."""
        coach_id = query.coach_id if is_federation else actor_id
        items = await self._groups.search(query.organization_id, coach_id, query.discipline_id, query.stage, query.active_only)
        return items, await self._groups.sizes([item.id for item in items])

    async def get(
        self, actor_id: UUID, is_federation: bool, group_id: int
    ) -> tuple[TrainingGroupModel, Sequence[GroupEnrollmentModel]]:
        """Возвращает группу и все её зачисления: текущие и прошлые."""
        group = await self._group(group_id)
        self._access.group(actor_id, is_federation, group)
        return group, await self._groups.enrollments(group_id)

    async def create(self, actor_id: UUID, is_federation: bool, change: GroupChange, ip: str | None) -> TrainingGroupModel:
        """Создаёт группу по действующей программе организации; тренер создаёт группу только себе."""
        if (change.organization_id is None or change.discipline_id is None or change.stage is None
                or not change.name or change.start_year is None):
            raise ValidationFailed(fields={"name": ["Укажите организацию, дисциплину, этап, название и год набора"]})
        coach_id = change.coach_id if is_federation and change.coach_id else actor_id
        if not is_federation and change.coach_id not in (None, actor_id):
            raise Forbidden("Тренер создаёт группу только себе")
        organization = await self._organizations.get(change.organization_id)
        if organization is None or not organization.is_active:
            raise ValidationFailed(fields={"organization_id": ["Выберите действующую организацию"]})
        if not 2000 <= change.start_year <= today().year:
            raise ValidationFailed(fields={"start_year": ["Год набора от 2000 до текущего"]})
        await self._check(change.organization_id, change.discipline_id, change.stage, coach_id)
        if await self._groups.by_name(change.organization_id, change.name):
            raise NameTaken("В организации уже есть группа с таким названием")
        group = TrainingGroupModel(
            organization_id=change.organization_id, discipline_id=change.discipline_id, stage=change.stage,
            coach_id=coach_id, name=change.name, start_year=change.start_year,
        )
        self._groups.add(group)
        await self._groups.flush()
        await self._audit.write(AuditAction.TRAINING_GROUP_SAVE, actor_id, "training_group", None, {
            "id": group.id, "action": "create", "name": group.name, "stage": TRAINING_STAGE_TITLES[group.stage],
        }, ip)
        await self._uow.commit()
        return await self._group(group.id)

    async def update(
        self, actor_id: UUID, is_federation: bool, group_id: int, change: GroupChange, ip: str | None
    ) -> TrainingGroupModel:
        """Меняет название, тренера или закрывает группу; закрыть можно только пустую."""
        group = await self._group(group_id, lock=True)
        self._access.group(actor_id, is_federation, group)
        diff: dict[str, Any] = {}
        if change.name is not None and change.name != group.name:
            same = await self._groups.by_name(group.organization_id, change.name)
            if same is not None and same.id != group.id:
                raise NameTaken("В организации уже есть группа с таким названием")
            diff["name"], group.name = change.name, change.name
        if change.coach_id is not None and change.coach_id != group.coach_id:
            if not is_federation:
                raise Forbidden("Тренера группы меняет федерация")
            await self._check(group.organization_id, group.discipline_id, group.stage, change.coach_id)
            diff["coach_id"], group.coach_id = str(change.coach_id), change.coach_id
        if change.is_active is not None and change.is_active != group.is_active:
            if not change.is_active and (await self._groups.sizes([group.id])).get(group.id):
                raise InvalidStatus("В группе есть спортсмены. Переведите или отчислите их")
            diff["is_active"], group.is_active = change.is_active, change.is_active
        await self._groups.flush()
        if diff:
            await self._audit.write(AuditAction.TRAINING_GROUP_SAVE, actor_id, "training_group", None,
                                    {"id": group.id, "action": "update", **diff}, ip)
        await self._uow.commit()
        return await self._group(group.id)

    async def enroll(
        self, actor_id: UUID, is_federation: bool, group_id: int, athlete_id: UUID, move: Move, ip: str | None
    ) -> GroupEnrollmentModel:
        """Зачисляет спортсмена в группу и переносит этап и организацию в его спортивный профиль."""
        group = await self._group(group_id, lock=True)
        self._access.group(actor_id, is_federation, group)
        if not group.is_active:
            raise InvalidStatus("Группа закрыта")
        athlete = await self._users.get(athlete_id)
        if athlete is None or not athlete.is_active or not any(
            role.role == Role.ATHLETE and role.status == RoleStatus.VERIFIED for role in athlete.roles
        ):
            raise ValidationFailed(fields={"athlete_id": ["Выберите спортсмена из реестра"]})
        self._date(move.on, None)
        if await self._programs.open_program(group.organization_id, group.discipline_id, group.stage) is None:
            raise ValidationFailed(fields={"group_id": ["У организации нет действующей программы для этой группы"]})
        if await self._groups.open_in_discipline(athlete_id, group.discipline_id):
            raise AlreadyEnrolled()
        item = await self._open(group, athlete_id, actor_id, move, None)
        await self._audit.write(AuditAction.ENROLLMENT_ADD, actor_id, "training_group", None, {
            "id": group.id, "athlete_id": str(athlete_id), "athlete": full_name(athlete), "on": move.on.isoformat(),
            "order_number": move.order_number,
        }, ip)
        await self._notifications.training(
            [athlete_id], actor_id, T.TRAINING_ENROLLMENT, "Зачисление в группу",
            f"Вы зачислены в группу «{group.name}» ({group.organization.short_name or group.organization.name}), "
            f"этап «{TRAINING_STAGE_TITLES[group.stage]}».", "/cabinet/athlete/training",
        )
        await self._uow.commit()
        await self._groups.refresh(item)
        return item

    async def transfer(
        self, actor_id: UUID, is_federation: bool, enrollment_id: UUID, target_group_id: int, move: Move, ip: str | None
    ) -> GroupEnrollmentModel:
        """Переводит спортсмена в другую группу той же дисциплины: закрывает зачисление и открывает новое."""
        current = await self._enrollment(enrollment_id)
        self._access.group(actor_id, is_federation, current.group)
        target = await self._group(target_group_id, lock=True)
        item = await self.move(actor_id, current, target, move)
        await self._audit.write(AuditAction.ENROLLMENT_TRANSFER, actor_id, "training_group", None, {
            "id": target.id, "from_group": current.group_id, "athlete_id": str(current.athlete_id),
            "athlete": full_name(current.athlete), "on": move.on.isoformat(), "order_number": move.order_number,
        }, ip)
        await self._notifications.training(
            [current.athlete_id, target.coach_id], actor_id, T.TRAINING_ENROLLMENT, "Перевод в другую группу",
            f"{full_name(current.athlete)}: перевод из группы «{current.group.name}» в «{target.name}», "
            f"этап «{TRAINING_STAGE_TITLES[target.stage]}».", "/cabinet/athlete/training",
        )
        await self._uow.commit()
        await self._groups.refresh(item)
        return item

    async def move(
        self, actor_id: UUID, current: GroupEnrollmentModel, target: TrainingGroupModel, move: Move
    ) -> GroupEnrollmentModel:
        """Закрывает текущее зачисление переводом и открывает новое в целевой группе; без коммита."""
        if current.valid_to is not None:
            raise InvalidStatus("Зачисление уже закрыто")
        if not target.is_active or target.id == current.group_id:
            raise ValidationFailed(fields={"target_group_id": ["Выберите другую действующую группу"]})
        if target.discipline_id != current.group.discipline_id:
            raise ValidationFailed(fields={"target_group_id": ["Перевод — только в группу той же дисциплины"]})
        if await self._programs.open_program(target.organization_id, target.discipline_id, target.stage) is None:
            raise ValidationFailed(fields={"target_group_id": ["У организации нет действующей программы для этой группы"]})
        self._date(move.on, current.valid_from)
        current.valid_to, current.end_reason = move.on, EnrollmentEnd.TRANSFERRED
        await self._groups.flush()
        return await self._open(target, current.athlete_id, actor_id, move, current.id)

    async def expel(
        self, actor_id: UUID, is_federation: bool, enrollment_id: UUID, move: Move, ip: str | None
    ) -> GroupEnrollmentModel:
        """Отчисляет спортсмена из группы датой; история зачисления остаётся."""
        current = await self._enrollment(enrollment_id)
        self._access.group(actor_id, is_federation, current.group)
        if current.valid_to is not None:
            raise InvalidStatus("Зачисление уже закрыто")
        self._date(move.on, current.valid_from)
        current.valid_to, current.end_reason = move.on, EnrollmentEnd.EXPELLED
        current.note = move.note or current.note
        await self._groups.flush()
        await self._audit.write(AuditAction.ENROLLMENT_EXPEL, actor_id, "training_group", None, {
            "id": current.group_id, "athlete_id": str(current.athlete_id), "athlete": full_name(current.athlete),
            "on": move.on.isoformat(), "order_number": move.order_number,
        }, ip)
        await self._notifications.training(
            [current.athlete_id], actor_id, T.TRAINING_ENROLLMENT, "Отчисление из группы",
            f"Вы отчислены из группы «{current.group.name}» с {move.on.strftime('%d.%m.%Y')}.", "/cabinet/athlete/training",
        )
        await self._uow.commit()
        return current

    async def history(self, actor_id: UUID, is_federation: bool, athlete_id: UUID) -> Sequence[GroupEnrollmentModel]:
        """Возвращает историю зачислений спортсмена ему, его тренеру и федерации."""
        await self._access.athlete(actor_id, is_federation, athlete_id)
        return await self._groups.of_athlete(athlete_id)

    async def _open(
        self, group: TrainingGroupModel, athlete_id: UUID, actor_id: UUID, move: Move, previous_id: UUID | None
    ) -> GroupEnrollmentModel:
        """Открывает зачисление и переносит в спортивный профиль этап, организацию и дисциплину группы."""
        item = GroupEnrollmentModel(
            group_id=group.id, athlete_id=athlete_id, valid_from=move.on, order_number=move.order_number,
            note=move.note, previous_id=previous_id, actor_id=actor_id,
        )
        self._groups.add(item)
        profile = await self._profiles.ensure(athlete_id)
        profile.training_stage = group.stage
        if profile.organization_id != group.organization_id:
            period = await self._profiles.open_organization(athlete_id)
            if period is not None:
                period.valid_to = move.on
            self._profiles.add(AthleteOrganizationModel(user_id=athlete_id, organization_id=group.organization_id, valid_from=move.on))
            profile.organization_id, profile.no_organization = group.organization_id, False
        if all(own.discipline_id != group.discipline_id for own in await self._profiles.disciplines(athlete_id)):
            self._profiles.add(AthleteDisciplineModel(user_id=athlete_id, discipline_id=group.discipline_id, valid_from=move.on))
        await self._groups.flush()
        return item

    async def _check(self, organization_id: int, discipline_id: int, stage: TrainingStage, coach_id: UUID) -> None:
        """Проверяет, что у организации есть программа под группу, а тренер в ней работает."""
        errors: dict[str, list[str]] = {}
        if await self._programs.open_program(organization_id, discipline_id, stage) is None:
            errors["stage"] = ["У организации нет действующей программы по этой дисциплине и этапу"]
        if await self._programs.open_coach(organization_id, coach_id) is None:
            errors["coach_id"] = ["Тренер не числится тренером-преподавателем организации"]
        if errors:
            raise ValidationFailed(fields=errors)

    @staticmethod
    def _date(on: date, since: date | None) -> None:
        """Проверяет дату приказа: не в будущем и не раньше начала текущего зачисления."""
        if on > today():
            raise ValidationFailed(fields={"on": ["Дата не может быть в будущем"]})
        if since is not None and on < since:
            raise ValidationFailed(fields={"on": ["Дата раньше начала текущего зачисления"]})

    async def _group(self, group_id: int, lock: bool = False) -> TrainingGroupModel:
        """Возвращает группу или бросает NotFound."""
        group = await self._groups.get(group_id, lock)
        if group is None:
            raise NotFound("Группа не найдена")
        return group

    async def _enrollment(self, enrollment_id: UUID) -> GroupEnrollmentModel:
        """Возвращает зачисление или бросает NotFound."""
        item = await self._groups.enrollment(enrollment_id)
        if item is None:
            raise NotFound("Зачисление не найдено")
        return item
