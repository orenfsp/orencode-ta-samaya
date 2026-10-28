from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.training.organization_coach import OrganizationCoachModel
from infrastructure.training.organization_program import OrganizationProgramModel
from infrastructure.training.training_group import TrainingGroupModel
from infrastructure.enums import TrainingStage

P, C = OrganizationProgramModel, OrganizationCoachModel


class ProgramRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def programs(self, organization_id: int) -> Sequence[OrganizationProgramModel]:
        """Возвращает действующие программы организации по дисциплине и этапу."""
        query = select(P).where(P.organization_id == organization_id, P.valid_to.is_(None))
        return (await self._db.scalars(query.order_by(P.discipline_id, P.stage))).all()

    async def all_open_programs(self) -> Sequence[OrganizationProgramModel]:
        """Возвращает все действующие программы всех организаций."""
        return (await self._db.scalars(select(P).where(P.valid_to.is_(None)))).all()

    async def program(self, program_id: int) -> OrganizationProgramModel | None:
        """Возвращает программу по id или None."""
        return await self._db.get(P, program_id)

    async def open_program(self, organization_id: int, discipline_id: int, stage: TrainingStage) -> OrganizationProgramModel | None:
        """Возвращает действующую программу организации по дисциплине и этапу или None."""
        query = select(P).where(
            P.organization_id == organization_id, P.discipline_id == discipline_id, P.stage == stage, P.valid_to.is_(None)
        )
        return await self._db.scalar(query)

    async def coaches(self, organization_id: int) -> Sequence[OrganizationCoachModel]:
        """Возвращает действующих тренеров-преподавателей организации."""
        query = select(C).where(C.organization_id == organization_id, C.valid_to.is_(None))
        return (await self._db.scalars(query.order_by(C.valid_from))).all()

    async def coach(self, record_id: int) -> OrganizationCoachModel | None:
        """Возвращает запись тренера организации по id или None."""
        return await self._db.get(C, record_id)

    async def open_coach(self, organization_id: int, coach_id: UUID) -> OrganizationCoachModel | None:
        """Возвращает действующую запись тренера в организации или None."""
        query = select(C).where(C.organization_id == organization_id, C.coach_id == coach_id, C.valid_to.is_(None))
        return await self._db.scalar(query)

    async def coach_organizations(self, coach_id: UUID) -> Sequence[int]:
        """Возвращает организации, где тренер сейчас работает."""
        query = select(C.organization_id).where(C.coach_id == coach_id, C.valid_to.is_(None))
        return (await self._db.scalars(query)).all()

    async def active_groups_count(self, organization_id: int, discipline_id: int, stage: TrainingStage) -> int:
        """Считает действующие группы организации по дисциплине и этапу."""
        query = select(func.count()).select_from(TrainingGroupModel).where(
            TrainingGroupModel.organization_id == organization_id, TrainingGroupModel.discipline_id == discipline_id,
            TrainingGroupModel.stage == stage, TrainingGroupModel.is_active,
        )
        return await self._db.scalar(query) or 0

    def add(self, item: OrganizationProgramModel | OrganizationCoachModel) -> None:
        """Добавляет программу или тренера организации."""
        self._db.add(item)

    async def flush(self) -> None:
        """Отправляет накопленные изменения в БД."""
        await self._db.flush()
