from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import InUse, NameTaken, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import TRAINING_STAGE_TITLES, Role, RoleStatus, TrainingStage
from infrastructure.sport.organization import OrganizationModel
from infrastructure.training.organization_coach import OrganizationCoachModel
from infrastructure.training.organization_program import OrganizationProgramModel
from infrastructure.training.training_group import TrainingGroupModel
from profiles.repositories.pg_organizations import OrganizationRepository
from training.domain.access import full_name, today
from training.repositories.pg_groups import GroupRepository
from training.repositories.pg_programs import ProgramRepository


@dataclass(frozen=True, slots=True)
class OrganizationCard:
    organization: OrganizationModel
    programs: Sequence[OrganizationProgramModel]
    coaches: Sequence[OrganizationCoachModel]
    groups: Sequence[TrainingGroupModel]
    sizes: dict[int, int]


class Programs:
    """Карточка организации спортивной подготовки: программы по этапам и дисциплинам, тренеры-преподаватели."""

    def __init__(
        self,
        uow: UnitOfWork,
        programs: ProgramRepository,
        organizations: OrganizationRepository,
        groups: GroupRepository,
        users: UserRepository,
        dictionary: DictionaryRepository,
        audit: Audit,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._programs, self._organizations, self._groups = uow, programs, organizations, groups
        self._users, self._dictionary, self._audit = users, dictionary, audit

    async def card(self, organization_id: int, public: bool) -> OrganizationCard:
        """Собирает карточку организации: программы, тренеры, действующие группы и их численность."""
        organization = await self._organizations.get(organization_id)
        if organization is None or (public and not organization.is_active):
            raise NotFound("Организация не найдена")
        groups = await self._groups.search(organization_id, None, None, None, True)
        return OrganizationCard(
            organization=organization,
            programs=await self._programs.programs(organization_id),
            coaches=await self._programs.coaches(organization_id),
            groups=groups,
            sizes=await self._groups.sizes([group.id for group in groups]),
        )

    async def add_program(
        self, actor_id: UUID, organization_id: int, discipline_id: int, stage: TrainingStage, ip: str | None
    ) -> OrganizationCard:
        """Добавляет организации программу подготовки по дисциплине и этапу с сегодняшнего дня."""
        organization = await self._organizations.get(organization_id)
        if organization is None:
            raise NotFound("Организация не найдена")
        discipline = await self._dictionary.get(DictionaryDisciplineModel, discipline_id)
        if discipline is None or discipline.is_archived:
            raise ValidationFailed(fields={"discipline_id": ["Выберите дисциплину из справочника"]})
        if await self._programs.open_program(organization_id, discipline_id, stage):
            raise NameTaken("Такая программа у организации уже есть")
        self._programs.add(OrganizationProgramModel(
            organization_id=organization_id, discipline_id=discipline_id, stage=stage, valid_from=today(),
        ))
        await self._programs.flush()
        await self._audit.write(AuditAction.TRAINING_PROGRAM_SAVE, actor_id, "organization", None, {
            "id": organization_id, "action": "add", "discipline": discipline.name, "stage": TRAINING_STAGE_TITLES[stage],
        }, ip)
        await self._uow.commit()
        return await self.card(organization_id, False)

    async def close_program(self, actor_id: UUID, organization_id: int, program_id: int, ip: str | None) -> OrganizationCard:
        """Закрывает программу сегодняшним днём; нельзя, пока по ней работают группы."""
        program = await self._programs.program(program_id)
        if program is None or program.organization_id != organization_id or program.valid_to is not None:
            raise NotFound("Программа не найдена")
        if await self._programs.active_groups_count(organization_id, program.discipline_id, program.stage):
            raise InUse("По программе занимаются группы. Сначала закройте или переведите их")
        program.valid_to = today()
        await self._programs.flush()
        await self._audit.write(AuditAction.TRAINING_PROGRAM_SAVE, actor_id, "organization", None, {
            "id": organization_id, "action": "close", "discipline": program.discipline.name,
            "stage": TRAINING_STAGE_TITLES[program.stage],
        }, ip)
        await self._uow.commit()
        return await self.card(organization_id, False)

    async def add_coach(
        self, actor_id: UUID, organization_id: int, coach_id: UUID, position: str, ip: str | None
    ) -> OrganizationCard:
        """Добавляет в организацию тренера-преподавателя с подтверждённой ролью тренера."""
        if await self._organizations.get(organization_id) is None:
            raise NotFound("Организация не найдена")
        coach = await self._users.get(coach_id)
        if coach is None or not coach.is_active or not any(
            role.role == Role.COACH and role.status == RoleStatus.VERIFIED for role in coach.roles
        ):
            raise ValidationFailed(fields={"coach_id": ["Выберите тренера с подтверждённой ролью"]})
        if await self._programs.open_coach(organization_id, coach_id):
            raise NameTaken("Тренер уже работает в этой организации")
        self._programs.add(OrganizationCoachModel(
            organization_id=organization_id, coach_id=coach_id, position=position, valid_from=today(),
        ))
        await self._programs.flush()
        await self._audit.write(AuditAction.ORGANIZATION_COACH_SAVE, actor_id, "organization", None, {
            "id": organization_id, "action": "add", "coach": full_name(coach), "position": position,
        }, ip)
        await self._uow.commit()
        return await self.card(organization_id, False)

    async def close_coach(self, actor_id: UUID, organization_id: int, record_id: int, ip: str | None) -> OrganizationCard:
        """Завершает работу тренера в организации; нельзя, пока он ведёт её действующие группы."""
        record = await self._programs.coach(record_id)
        if record is None or record.organization_id != organization_id or record.valid_to is not None:
            raise NotFound("Тренер организации не найден")
        if await self._groups.search(organization_id, record.coach_id, None, None, True):
            raise InUse("Тренер ведёт группы организации. Сначала передайте их другому тренеру")
        record.valid_to = today()
        await self._programs.flush()
        await self._audit.write(AuditAction.ORGANIZATION_COACH_SAVE, actor_id, "organization", None, {
            "id": organization_id, "action": "close", "coach": full_name(record.coach),
        }, ip)
        await self._uow.commit()
        return await self.card(organization_id, False)
