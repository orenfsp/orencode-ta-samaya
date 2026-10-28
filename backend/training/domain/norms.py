from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import Forbidden, NotFound, ValidationFailed
from infrastructure.enums import NormDirection, NormKind, NormUnit, Sex, TrainingStage
from infrastructure.training.attestation import AttestationModel
from infrastructure.training.norm_result import NormResultModel
from infrastructure.training.standard_norm import StandardNormModel
from training.domain.access import Access, full_name, today
from training.repositories.pg_norms import NormRepository

VALID_DAYS = 365
NormState = Literal["passed", "failed", "missing", "no_sex"]


def threshold(norm: StandardNormModel, sex: Sex | None) -> Decimal | None:
    """Порог норматива для пола; без пола — только если пороги одинаковые."""
    if sex == Sex.MALE:
        return norm.threshold_male
    if sex == Sex.FEMALE:
        return norm.threshold_female
    return norm.threshold_male if norm.threshold_male == norm.threshold_female else None


def passes(norm: StandardNormModel, value: Decimal, limit: Decimal) -> bool:
    """Проверяет результат по порогу: «не менее» или «не более»."""
    return value >= limit if norm.direction == NormDirection.HIGHER else value <= limit


def applies(norm: StandardNormModel, stage: TrainingStage, discipline_id: int) -> bool:
    """Проверяет, что действующий норматив относится к этапу и дисциплине."""
    return (not norm.is_archived and norm.stage == stage
            and (not norm.disciplines or any(item.id == discipline_id for item in norm.disciplines)))


@dataclass(frozen=True, slots=True)
class NormChange:
    stage: TrainingStage | None = None
    kind: NormKind | None = None
    name: str | None = None
    unit: NormUnit | None = None
    direction: NormDirection | None = None
    threshold_male: Decimal | None = None
    threshold_female: Decimal | None = None
    discipline_ids: list[int] | None = None
    source: str | None = None
    is_demo: bool | None = None
    sort_order: int | None = None
    is_archived: bool | None = None
    fields: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class ResultInput:
    athlete_id: UUID
    norm_id: int
    value: Decimal
    passed_on: date


@dataclass(slots=True)
class NormStatus:
    norm: StandardNormModel
    threshold: Decimal | None
    state: NormState
    best: NormResultModel | None = None


@dataclass(slots=True)
class Readiness:
    stage: TrainingStage
    target: TrainingStage | None
    norms: list[NormStatus] = field(default_factory=list)

    @property
    def ready(self) -> bool:
        """Готов к переводу: нормативы следующего этапа есть и все выполнены."""
        return bool(self.norms) and all(item.state == "passed" for item in self.norms)


class Norms:
    """Нормативы ФССП: справочник, приём результатов сдачи с автоматической отметкой и готовность к переводу."""

    FIELDS = ("stage", "kind", "name", "unit", "direction", "threshold_male", "threshold_female", "source", "is_demo",
              "sort_order", "is_archived")

    def __init__(
        self, uow: UnitOfWork, norms: NormRepository, users: UserRepository, access: Access, audit: Audit
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._norms, self._users, self._access, self._audit = uow, norms, users, access, audit

    async def catalog(self, stage: TrainingStage | None, include_archived: bool) -> Sequence[StandardNormModel]:
        """Возвращает справочник нормативов по этапу."""
        return await self._norms.norms(stage, include_archived)

    async def create(self, actor_id: UUID, change: NormChange, ip: str | None) -> StandardNormModel:
        """Добавляет норматив в справочник федерации."""
        missing = [name for name in ("stage", "kind", "name", "unit", "direction", "source") if getattr(change, name) is None]
        if missing:
            raise ValidationFailed(fields={name: ["Обязательное поле"] for name in missing})
        item = StandardNormModel(**{name: getattr(change, name) for name in self.FIELDS if getattr(change, name) is not None})
        item.disciplines = list(await self._norms.disciplines(change.discipline_ids or []))
        self._check(item, change)
        self._norms.add(item)
        await self._norms.flush()
        await self._audit.write(AuditAction.NORM_SAVE, actor_id, "standard_norm", None,
                                {"id": item.id, "action": "create", "name": item.name, "stage": item.stage.value}, ip)
        await self._uow.commit()
        await self._norms.refresh(item)
        return item

    async def update(self, actor_id: UUID, norm_id: int, change: NormChange, ip: str | None) -> StandardNormModel:
        """Правит норматив; уже внесённые результаты хранят свой порог и не пересчитываются."""
        item = await self._norm(norm_id)
        diff: dict[str, Any] = {}
        for name in self.FIELDS:
            value = getattr(change, name)
            if name in change.fields and value != getattr(item, name):
                diff[name] = {"old": str(getattr(item, name)), "new": str(value)}
                setattr(item, name, value)
        if change.discipline_ids is not None:
            wanted = list(await self._norms.disciplines(change.discipline_ids))
            if {d.id for d in wanted} != {d.id for d in item.disciplines}:
                diff["disciplines"] = {"old": sorted(d.id for d in item.disciplines), "new": sorted(d.id for d in wanted)}
                item.disciplines = wanted
        self._check(item, change)
        await self._norms.flush()
        if diff:
            await self._audit.write(AuditAction.NORM_SAVE, actor_id, "standard_norm", None,
                                    {"id": item.id, "action": "update", "name": item.name, **diff}, ip)
        await self._uow.commit()
        await self._norms.refresh(item)
        return item

    async def record(self, actor_id: UUID, is_federation: bool, items: Sequence[ResultInput], ip: str | None) -> list[NormResultModel]:
        """Принимает результаты сдачи от тренера спортсмена или федерации и сам отмечает, выполнен ли норматив."""
        if not items:
            raise ValidationFailed(fields={"items": ["Добавьте хотя бы один результат"]})
        athletes = list(dict.fromkeys(item.athlete_id for item in items))
        for athlete_id in athletes:
            if not is_federation and actor_id not in await self._access.coaches(athlete_id):
                raise Forbidden("Результаты вносит тренер спортсмена или федерация")
        profiles = await self._norms.profiles(athletes)
        errors: dict[str, list[str]] = {}
        saved: list[NormResultModel] = []
        for index, entry in enumerate(items):
            norm = await self._norms.norm(entry.norm_id)
            profile = profiles.get(entry.athlete_id)
            limit = threshold(norm, profile.sex if profile else None) if norm else None
            if norm is None or norm.is_archived:
                errors[f"items.{index}.norm_id"] = ["Норматив не найден в справочнике"]
            elif limit is None:
                errors[f"items.{index}.norm_id"] = [
                    "Укажите пол в спортивном профиле спортсмена: пороги для юношей и девушек разные"
                    if profile is None or profile.sex is None else "Для этого пола норматив не установлен"
                ]
            elif entry.value < 0:
                errors[f"items.{index}.value"] = ["Результат не может быть отрицательным"]
            elif entry.passed_on > today():
                errors[f"items.{index}.passed_on"] = ["Дата сдачи не может быть в будущем"]
            else:
                saved.append(NormResultModel(
                    athlete_id=entry.athlete_id, norm_id=norm.id, value=entry.value, threshold=limit,
                    passed=passes(norm, entry.value, limit), passed_on=entry.passed_on, recorded_by=actor_id,
                ))
        if errors:
            raise ValidationFailed(fields=errors)
        for item in saved:
            self._norms.add(item)
        await self._norms.flush()
        await self._audit.write(AuditAction.NORM_RESULT_ADD, actor_id, "standard_norm", None, {
            "results": len(saved), "passed": sum(item.passed for item in saved),
            "athletes": [str(athlete_id) for athlete_id in athletes],
        }, ip)
        await self._uow.commit()
        for item in saved:
            await self._norms.refresh(item)
        return saved

    async def history(
        self, actor_id: UUID, is_federation: bool, athlete_id: UUID
    ) -> tuple[str, Sequence[NormResultModel], Sequence[AttestationModel]]:
        """Возвращает ФИО, историю сдачи нормативов и аттестаций спортсмена ему, его тренеру и федерации."""
        await self._access.athlete(actor_id, is_federation, athlete_id)
        user = await self._users.get(athlete_id)
        if user is None:
            raise NotFound()
        return full_name(user), await self._norms.results([athlete_id]), await self._norms.attestations(athlete_id=athlete_id)

    async def readiness(
        self, stage: TrainingStage, target: TrainingStage | None, discipline_id: int, athlete_ids: Sequence[UUID]
    ) -> dict[UUID, Readiness]:
        """Оценивает каждого спортсмена по нормативам следующего этапа за последний год."""
        profiles = await self._norms.profiles(athlete_ids)
        catalog = [norm for norm in await self._norms.norms(target, False) if target and applies(norm, target, discipline_id)]
        since = today() - timedelta(days=VALID_DAYS)
        results: dict[tuple[UUID, int], list[NormResultModel]] = {}
        for item in await self._norms.results(athlete_ids, since):
            results.setdefault((item.athlete_id, item.norm_id), []).append(item)
        report: dict[UUID, Readiness] = {}
        for athlete_id in athlete_ids:
            profile = profiles.get(athlete_id)
            sex = profile.sex if profile else None
            row = Readiness(stage=stage, target=target)
            for norm in catalog:
                if sex is not None and threshold(norm, sex) is None:
                    continue
                limit = threshold(norm, sex)
                own = results.get((athlete_id, norm.id), [])
                if limit is None:
                    row.norms.append(NormStatus(norm, None, "no_sex"))
                    continue
                best = next((item for item in own if passes(norm, item.value, limit)), own[0] if own else None)
                state: NormState = "missing" if best is None else "passed" if passes(norm, best.value, limit) else "failed"
                row.norms.append(NormStatus(norm, limit, state, best))
            report[athlete_id] = row
        return report

    @staticmethod
    def _check(item: StandardNormModel, change: NormChange) -> None:
        """Проверяет название, пороги и дисциплины норматива; бросает ValidationFailed."""
        errors: dict[str, list[str]] = {}
        if not (item.name or "").strip():
            errors["name"] = ["Укажите упражнение"]
        if item.threshold_male is None and item.threshold_female is None:
            errors["threshold_male"] = ["Укажите порог хотя бы для одного пола"]
        if any(value is not None and value < 0 for value in (item.threshold_male, item.threshold_female)):
            errors["threshold_male"] = ["Порог не может быть отрицательным"]
        if change.discipline_ids and len(item.disciplines) != len(set(change.discipline_ids)):
            errors["discipline_ids"] = ["Выберите дисциплины из справочника"]
        if errors:
            raise ValidationFailed(fields=errors)

    async def _norm(self, norm_id: int) -> StandardNormModel:
        """Возвращает норматив или бросает NotFound."""
        item = await self._norms.norm(norm_id)
        if item is None:
            raise NotFound("Норматив не найден")
        return item
