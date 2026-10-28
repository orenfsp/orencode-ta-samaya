from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.enums import ApplicationStatus, ContestStatus, QualificationKind, QualificationStatus
from infrastructure.qualifications.evsk_rule import EvskRuleModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel

UPCOMING = (ContestStatus.PUBLISHED, ContestStatus.REGISTRATION_OPEN, ContestStatus.REGISTRATION_CLOSED)
HELD = (ContestStatus.IN_PROGRESS, ContestStatus.COMPLETED, ContestStatus.ARCHIVED)


class EvskRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def rules(self) -> Sequence[EvskRuleModel]:
        """Возвращает правила ЕВСК по разряду, уровню и месту."""
        query = select(EvskRuleModel).order_by(EvskRuleModel.rank_type_id, EvskRuleModel.contest_level_id,
                                               EvskRuleModel.place_to)
        return (await self._db.scalars(query)).all()

    async def rule(self, rule_id: int) -> EvskRuleModel | None:
        """Возвращает правило по id или None."""
        return await self._db.get(EvskRuleModel, rule_id)

    async def add(self, item: EvskRuleModel) -> EvskRuleModel:
        """Добавляет правило и возвращает его с id."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def remove(self, item: EvskRuleModel) -> None:
        """Удаляет правило."""
        await self._db.delete(item)
        await self._db.flush()

    async def refresh(self, item: EvskRuleModel) -> EvskRuleModel:
        """Перечитывает правило из БД."""
        await self._db.refresh(item)
        return item

    async def contest(self, contest_id: int) -> ContestModel | None:
        """Возвращает соревнование по id или None."""
        return await self._db.get(ContestModel, contest_id)

    async def held(self, since: date) -> Sequence[ContestModel]:
        """Возвращает прошедшие и идущие соревнования, закончившиеся не раньше даты."""
        query = select(ContestModel).where(ContestModel.status.in_(HELD), ContestModel.ends_on >= since)
        return (await self._db.scalars(query.order_by(ContestModel.ends_on.desc()))).all()

    async def upcoming(self, level_ids: Sequence[int], discipline_ids: Sequence[int]) -> Sequence[ContestModel]:
        """Возвращает ближайшие соревнования нужных уровней и дисциплин с открытой записью."""
        if not level_ids:
            return []
        query = select(ContestModel).where(
            ContestModel.status.in_(UPCOMING), ContestModel.contest_level_id.in_(level_ids),
        )
        if discipline_ids:
            query = query.where(ContestModel.discipline_id.in_(discipline_ids))
        return (await self._db.scalars(query.order_by(ContestModel.starts_on).limit(10))).all()

    async def placed(self, contest_id: int) -> Sequence[ContestResultModel]:
        """Возвращает места участников соревнования."""
        query = (
            select(ContestResultModel)
            .join(ContestApplicationModel, ContestApplicationModel.id == ContestResultModel.application_id)
            .where(ContestResultModel.contest_id == contest_id, ContestResultModel.place.is_not(None),
                   ContestApplicationModel.status == ApplicationStatus.APPROVED)
            .order_by(ContestResultModel.place)
        )
        return (await self._db.scalars(query)).all()

    async def entries(self, contest_id: int) -> int:
        """Считает одобренные заявки соревнования."""
        query = select(func.count()).select_from(ContestApplicationModel).where(
            ContestApplicationModel.contest_id == contest_id, ContestApplicationModel.status == ApplicationStatus.APPROVED
        )
        return await self._db.scalar(query) or 0

    async def ranks(self, user_ids: Sequence[UUID]) -> dict[UUID, QualificationModel]:
        """Возвращает действующие разряды людей: человек → разряд."""
        if not user_ids:
            return {}
        query = select(QualificationModel).where(
            QualificationModel.user_id.in_(set(user_ids)), QualificationModel.kind == QualificationKind.RANK,
            QualificationModel.status.in_((QualificationStatus.APPROVED, QualificationStatus.PENDING)),
        )
        found: dict[UUID, QualificationModel] = {}
        for item in (await self._db.scalars(query)).all():
            current = found.get(item.user_id)
            if current is None or item.item_id < current.item_id:
                found[item.user_id] = item
        return found

    async def disciplines(self, user_id: UUID) -> list[int]:
        """Возвращает id текущих дисциплин спортсмена."""
        query = select(AthleteDisciplineModel.discipline_id).where(
            AthleteDisciplineModel.user_id == user_id, AthleteDisciplineModel.valid_to.is_(None)
        )
        return list((await self._db.scalars(query)).all())

    async def user(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id или None."""
        return await self._db.get(UserModel, user_id)

    async def approved_rank(self, user_id: UUID) -> QualificationModel | None:
        """Возвращает действующий разряд спортсмена или None."""
        query = select(QualificationModel).where(
            QualificationModel.user_id == user_id, QualificationModel.kind == QualificationKind.RANK,
            QualificationModel.status == QualificationStatus.APPROVED,
        )
        return await self._db.scalar(query)
