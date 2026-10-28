from collections.abc import Sequence
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import TrainingStage
from infrastructure.sport.athlete_profile import AthleteProfileModel
from infrastructure.training.attestation import AttestationModel
from infrastructure.training.norm_result import NormResultModel
from infrastructure.training.standard_norm import StandardNormModel

N, R, A = StandardNormModel, NormResultModel, AttestationModel


class NormRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def norms(self, stage: TrainingStage | None, include_archived: bool) -> Sequence[StandardNormModel]:
        """Возвращает нормативы по этапу в порядке справочника."""
        conditions: list[Any] = []
        if stage is not None:
            conditions.append(N.stage == stage)
        if not include_archived:
            conditions.append(N.is_archived.is_(False))
        return (await self._db.scalars(select(N).where(*conditions).order_by(N.stage, N.kind, N.sort_order, N.id))).all()

    async def norm(self, norm_id: int) -> StandardNormModel | None:
        """Возвращает норматив по id или None."""
        return await self._db.get(N, norm_id)

    async def disciplines(self, ids: Sequence[int]) -> Sequence[DictionaryDisciplineModel]:
        """Возвращает дисциплины справочника по id."""
        if not ids:
            return []
        return (await self._db.scalars(select(DictionaryDisciplineModel).where(DictionaryDisciplineModel.id.in_(ids)))).all()

    async def has_results(self, norm_id: int) -> bool:
        """Проверяет, сдавали ли норматив хоть раз."""
        return await self._db.scalar(select(R.id).where(R.norm_id == norm_id).limit(1)) is not None

    async def results(self, athlete_ids: Sequence[UUID], since: date | None = None) -> Sequence[NormResultModel]:
        """Возвращает результаты сдачи спортсменов с даты, свежие первыми."""
        if not athlete_ids:
            return []
        conditions: list[Any] = [R.athlete_id.in_(athlete_ids)]
        if since is not None:
            conditions.append(R.passed_on >= since)
        return (await self._db.scalars(select(R).where(*conditions).order_by(R.passed_on.desc(), R.created_at.desc()))).all()

    async def profiles(self, athlete_ids: Sequence[UUID]) -> dict[UUID, AthleteProfileModel]:
        """Возвращает спортивные профили спортсменов: человек → профиль."""
        if not athlete_ids:
            return {}
        rows = await self._db.scalars(select(AthleteProfileModel).where(AthleteProfileModel.user_id.in_(athlete_ids)))
        return {item.user_id: item for item in rows.all()}

    async def attestations(self, athlete_id: UUID | None = None, group_id: int | None = None) -> Sequence[AttestationModel]:
        """Возвращает аттестации спортсмена или группы, новые первыми."""
        conditions: list[Any] = []
        if athlete_id is not None:
            conditions.append(A.athlete_id == athlete_id)
        if group_id is not None:
            conditions.append(A.group_id == group_id)
        return (await self._db.scalars(select(A).where(*conditions).order_by(A.decided_on.desc(), A.created_at.desc()))).all()

    def add(self, item: StandardNormModel | NormResultModel | AttestationModel) -> None:
        """Добавляет норматив, результат сдачи или аттестацию."""
        self._db.add(item)

    async def flush(self) -> None:
        """Отправляет накопленные изменения в БД."""
        await self._db.flush()

    async def refresh(self, item: object) -> None:
        """Перечитывает объект из БД."""
        await self._db.refresh(item)
