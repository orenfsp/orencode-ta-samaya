from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import Forbidden, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from evsk.repositories.pg_evsk import EvskRepository
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.dictionaries.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.enums import QualificationStatus, Role
from infrastructure.qualifications.evsk_rule import EvskRuleModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel

FIELDS = ("rank_type_id", "contest_level_id", "discipline_id", "place_to", "min_participants", "min_age", "max_age",
          "source", "is_demo", "note")


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


def age_on(birth: date, on: date) -> int:
    """Считает полных лет на дату."""
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def fits(rule: EvskRuleModel, contest: ContestModel, place: int, entries: int, age: int) -> bool:
    """Проверяет, подходит ли место на соревновании под правило ЕВСК: уровень, дисциплина, место, участники, возраст."""
    return (
        rule.contest_level_id == contest.contest_level_id
        and (rule.discipline_id is None or rule.discipline_id == contest.discipline_id)
        and place <= rule.place_to
        and entries >= rule.min_participants
        and (rule.min_age is None or age >= rule.min_age)
        and (rule.max_age is None or age <= rule.max_age)
    )


@dataclass(frozen=True, slots=True)
class Candidate:
    contest: ContestModel
    result: ContestResultModel
    user: UserModel
    rule: EvskRuleModel
    current: QualificationModel | None


@dataclass(frozen=True, slots=True)
class PathStep:
    rank: DictionaryRankTypeModel
    rules: list[EvskRuleModel]


@dataclass(frozen=True, slots=True)
class Path:
    current: QualificationModel | None
    next: PathStep | None
    later: list[DictionaryRankTypeModel]
    contests: list[ContestModel]
    achieved: list[Candidate]


class Evsk:
    """Правила ЕВСК, претенденты на разряд по местам и личный путь спортсмена."""

    def __init__(self, uow: UnitOfWork, repository: EvskRepository, dictionary: DictionaryRepository, audit: Audit) -> None:
        """Сохраняет зависимости."""
        self._uow, self._repository, self._dictionary, self._audit = uow, repository, dictionary, audit

    async def rules(self) -> Sequence[EvskRuleModel]:
        """Возвращает все правила ЕВСК."""
        return await self._repository.rules()

    async def save(self, actor_id: UUID, rule_id: int | None, data: dict[str, Any], ip: str | None) -> EvskRuleModel:
        """Создаёт или правит правило ЕВСК после проверки и пишет действие в журнал."""
        await self._check(data)
        if rule_id is None:
            item = await self._repository.add(EvskRuleModel(**{name: data.get(name) for name in FIELDS if name in data}))
        else:
            found = await self._repository.rule(rule_id)
            if found is None:
                raise NotFound()
            item = found
            for name in FIELDS:
                if name in data:
                    setattr(item, name, data[name])
        await self._audit.write(AuditAction.EVSK_RULE_SAVE, actor_id, None, None,
                                {"id": item.id, "rank_type_id": item.rank_type_id, "place_to": item.place_to}, ip)
        await self._uow.commit()
        return await self._repository.refresh(item)

    async def remove(self, actor_id: UUID, rule_id: int, ip: str | None) -> None:
        """Удаляет правило ЕВСК и пишет действие в журнал."""
        item = await self._repository.rule(rule_id)
        if item is None:
            raise NotFound()
        await self._repository.remove(item)
        await self._audit.write(AuditAction.EVSK_RULE_SAVE, actor_id, None, None, {"id": rule_id, "removed": True}, ip)
        await self._uow.commit()

    async def contest(self, actor_id: UUID, roles: frozenset[Role], contest_id: int) -> list[Candidate]:
        """Возвращает претендентов на разряд по местам соревнования для организатора и федерации."""
        contest = await self._repository.contest(contest_id)
        if contest is None:
            raise NotFound()
        if Role.FEDERATION not in roles and contest.organizer_id != actor_id:
            raise Forbidden()
        return await self.candidates(contest)

    async def candidates(self, contest: ContestModel) -> list[Candidate]:
        """Сопоставляет места соревнования с правилами и возвращает тех, чей разряд ниже возможного."""
        rules = await self._repository.rules()
        rows = await self._repository.placed(contest.id)
        if not rules or not rows:
            return []
        entries = await self._repository.entries(contest.id)
        held = await self._repository.ranks([row.user_id for row in rows])
        result: list[Candidate] = []
        for row in rows:
            if row.place is None:
                continue
            age = age_on(row.user.birth_date, contest.starts_on)
            matched = [rule for rule in rules if fits(rule, contest, row.place, entries, age)]
            if not matched:
                continue
            best = min(matched, key=lambda rule: rule.rank_type_id)
            current = held.get(row.user_id)
            if current is not None and current.item_id <= best.rank_type_id and (
                current.status == QualificationStatus.PENDING or current.valid_until is None
                or current.valid_until >= today()
            ):
                continue
            result.append(Candidate(contest, row, row.user, best, current))
        return result

    async def recent(self, days: int = 365) -> list[Candidate]:
        """Собирает претендентов на разряд по соревнованиям за последние дни."""
        found: list[Candidate] = []
        for contest in await self._repository.held(today() - timedelta(days=days)):
            found += await self.candidates(contest)
        return found

    async def path(self, user_id: UUID) -> Path:
        """Строит личный путь: текущий разряд, следующий, условия по ЕВСК и подходящие соревнования."""
        user = await self._repository.user(user_id)
        if user is None:
            raise NotFound()
        current = await self._repository.approved_rank(user_id)
        if current is not None and current.valid_until is not None and current.valid_until < today():
            current = None
        ranks = sorted(
            (item for item in await self._dictionary.list(DictionaryRankTypeModel, False) if not item.is_archived),
            key=lambda item: item.id, reverse=True,
        )
        age = age_on(user.birth_date, today())
        ahead = [item for item in ranks if current is None or item.id < current.item_id]
        ahead = [item for item in ahead if item.min_age is None or item.min_age <= age + 1]
        rules = await self._repository.rules()
        target = next((item for item in ahead if any(rule.rank_type_id == item.id for rule in rules)), None)
        step = PathStep(target, [rule for rule in rules if rule.rank_type_id == target.id]) if target else None
        contests: list[ContestModel] = []
        if step:
            disciplines = await self._repository.disciplines(user_id)
            levels = sorted({rule.contest_level_id for rule in step.rules})
            contests = [
                contest for contest in await self._repository.upcoming(levels, disciplines)
                if not contest.age_groups or any(
                    (group.min_age is None or age_on(user.birth_date, contest.starts_on) >= group.min_age)
                    and (group.max_age is None or age_on(user.birth_date, contest.starts_on) <= group.max_age)
                    for group in contest.age_groups
                )
            ]
        achieved = [item for item in await self.recent() if item.user.id == user_id]
        later = [item for item in ahead if step is None or item.id != step.rank.id][:3]
        return Path(current=current, next=step, later=later, contests=contests, achieved=achieved)

    async def _check(self, data: dict[str, Any]) -> None:
        """Проверяет поля правила и справочные ссылки; бросает ValidationFailed."""
        errors: dict[str, list[str]] = {}
        if data.get("rank_type_id") and await self._dictionary.get(DictionaryRankTypeModel, data["rank_type_id"]) is None:
            errors["rank_type_id"] = ["Выберите разряд из справочника"]
        if data.get("contest_level_id") and await self._dictionary.get(
            DictionaryContestLevelModel, data["contest_level_id"]
        ) is None:
            errors["contest_level_id"] = ["Выберите уровень из справочника"]
        if data.get("discipline_id") and await self._dictionary.get(DictionaryDisciplineModel, data["discipline_id"]) is None:
            errors["discipline_id"] = ["Выберите дисциплину из справочника"]
        low, high = data.get("min_age"), data.get("max_age")
        if low is not None and high is not None and high < low:
            errors["max_age"] = ["Меньше минимального возраста"]
        if errors:
            raise ValidationFailed(fields=errors)
