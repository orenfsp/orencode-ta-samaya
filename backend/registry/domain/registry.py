from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from core.errors import ValidationFailed
from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.sport.athlete_organization import AthleteOrganizationModel
from infrastructure.sport.athlete_profile import AthleteProfileModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import TRAINING_STAGE_TITLES, QualificationKind, Role, TrainingStage
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel
from infrastructure.training.group_enrollment import GroupEnrollmentModel
from registry.repositories.pg_registry import RegistryRepository

Cut = Literal["total", "discipline", "organization", "age_group", "municipality", "stage"]
CategoryState = Literal["valid", "expiring", "expired", "none"]
EXPIRING_DAYS = 30
NO_ORGANIZATION = "Без организации"
NO_MUNICIPALITY = "Муниципалитет не указан"
NO_GROUP = "Вне возрастных групп"
NO_STAGE = "Не зачислены в учебно-тренировочные группы"
SOURCES = ("Спортивные профили: периоды дисциплин и организаций", "Учебно-тренировочные группы: зачисления и переводы")


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


def age_on(birth: date, on: date) -> int:
    """Считает полных лет на дату."""
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def full_name(user: UserModel) -> str:
    """Собирает фамилию, имя и отчество в одну строку."""
    return " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)


def covers(start: date, end: date | None, on: date) -> bool:
    """Проверяет, что период [начало, конец) включает дату."""
    return start <= on and (end is None or end > on)


def valid_on(item: QualificationModel | None, on: date) -> bool:
    """Проверяет, что квалификация действует на дату."""
    return item is not None and (item.valid_until is None or item.valid_until >= on)


@dataclass(frozen=True, slots=True)
class AthleteFilter:
    q: str | None = None
    discipline_id: int | None = None
    organization_id: int | None = None
    no_organization: bool = False
    municipality_id: int | None = None
    age_group_id: int | None = None
    rank_type_id: int | None = None
    without_rank: bool = False
    training_stage: TrainingStage | None = None


@dataclass(slots=True)
class AthleteRow:
    user: UserModel
    age: int
    age_group: DictionaryAgeGroupModel | None
    profile: AthleteProfileModel | None
    disciplines: list[AthleteDisciplineModel]
    rank: QualificationModel | None
    coaches: list[CoachLinkModel]


@dataclass(slots=True)
class CoachRow:
    user: UserModel
    athletes: int
    disciplines: list[str]


@dataclass(slots=True)
class JudgeRow:
    user: UserModel
    category: QualificationModel | None
    state: CategoryState
    assignments: int


@dataclass(slots=True)
class HeadcountRow:
    label: str
    counts: list[int]


@dataclass(slots=True)
class Headcount:
    years: list[int]
    dates: list[date]
    cut: Cut
    total: list[int]
    in_groups: list[int]
    rows: list[HeadcountRow] = field(default_factory=list)
    sources: tuple[str, ...] = SOURCES


def search(q: str | None) -> Callable[[UserModel], bool]:
    """Возвращает проверку человека по строке поиска в ФИО и почте, ё и е не различаются."""
    needle = (q or "").strip().lower().replace("ё", "е")
    return lambda user: not needle or needle in full_name(user).lower().replace("ё", "е") or needle in user.email.lower()


class Registry:
    """Реестр федерации и отчёт о численности занимающихся."""

    def __init__(self, repository: RegistryRepository) -> None:
        """Сохраняет репозиторий."""
        self._repository = repository

    async def athletes(self, query: AthleteFilter) -> list[AthleteRow]:
        """Возвращает реестр спортсменов с фильтрами."""
        now = today()
        users = await self._repository.people(Role.ATHLETE)
        profiles = await self._repository.profiles()
        groups = await self._repository.age_groups()
        ranks = await self._repository.qualifications(QualificationKind.RANK)
        coaches = await self._repository.coaches_of()
        disciplines: dict[UUID, list[AthleteDisciplineModel]] = defaultdict(list)
        for item in await self._repository.disciplines():
            if item.valid_to is None:
                disciplines[item.user_id].append(item)
        matches = search(query.q)
        rows: list[AthleteRow] = []
        for user in users:
            if not matches(user):
                continue
            age = age_on(user.birth_date, now)
            group = next((item for item in groups if self._fits(item, age)), None)
            profile = profiles.get(user.id)
            rank = ranks.get(user.id) if valid_on(ranks.get(user.id), now) else None
            own = disciplines.get(user.id, [])
            if query.discipline_id and not any(item.discipline_id == query.discipline_id for item in own):
                continue
            if query.no_organization and profile is not None and profile.organization_id is not None:
                continue
            if query.organization_id and (profile is None or profile.organization_id != query.organization_id):
                continue
            if query.municipality_id and user.municipality_id != query.municipality_id:
                continue
            if query.age_group_id:
                wanted = next((item for item in groups if item.id == query.age_group_id), None)
                if wanted is None or not self._fits(wanted, age):
                    continue
            if query.without_rank and rank is not None:
                continue
            if query.rank_type_id and (rank is None or rank.rank_type_id != query.rank_type_id):
                continue
            if query.training_stage and (profile is None or profile.training_stage != query.training_stage):
                continue
            rows.append(AthleteRow(user, age, group, profile, own, rank, coaches.get(user.id, [])))
        return rows

    async def coaches(self, q: str | None, municipality_id: int | None, discipline_id: int | None) -> list[CoachRow]:
        """Возвращает реестр тренеров с числом спортсменов и дисциплинами."""
        links = await self._repository.athletes_of()
        matches = search(q)
        rows: list[CoachRow] = []
        for user in await self._repository.people(Role.COACH):
            own = links.get(user.id, [])
            if not matches(user) or (municipality_id and user.municipality_id != municipality_id):
                continue
            if discipline_id and not any(link.discipline_id == discipline_id for link in own):
                continue
            names = sorted({link.discipline.name for link in own})
            rows.append(CoachRow(user, len({link.athlete_id for link in own}), names))
        return rows

    async def judges(self, q: str | None, municipality_id: int | None, state: CategoryState | None) -> list[JudgeRow]:
        """Возвращает реестр судей с категорией, её состоянием и числом судейств за год."""
        now = today()
        categories = await self._repository.qualifications(QualificationKind.JUDGE_CATEGORY)
        counts = await self._repository.assignments(now - timedelta(days=365))
        matches = search(q)
        rows: list[JudgeRow] = []
        for user in await self._repository.people(Role.JUDGE):
            if not matches(user) or (municipality_id and user.municipality_id != municipality_id):
                continue
            category = categories.get(user.id)
            current = self._state(category, now)
            if state and current != state:
                continue
            rows.append(JudgeRow(user, category, current, counts.get(user.id, 0)))
        return rows

    async def headcount(self, since: int | None, until: int | None, cut: Cut) -> Headcount:
        """Считает численность занимающихся по годам в разрезе, без повторов человека в одной ячейке."""
        now = today()
        last = until or now.year
        first = since or last - 2
        if first > last or last - first > 15 or last > now.year:
            raise ValidationFailed(fields={"from": ["Период — от 2 до 16 лет, не позже текущего года"]})
        if last - first < 1:
            first = last - 1
        years = list(range(first, last + 1))
        dates = [now if year == now.year else date(year, 12, 31) for year in years]
        users = {user.id: user for user in await self._repository.people(Role.ATHLETE)}
        groups = await self._repository.age_groups()
        periods: dict[UUID, list[AthleteDisciplineModel]] = defaultdict(list)
        for item in await self._repository.disciplines():
            if item.user_id in users:
                periods[item.user_id].append(item)
        organizations: dict[UUID, list[AthleteOrganizationModel]] = defaultdict(list)
        for item in await self._repository.organization_periods():
            organizations[item.user_id].append(item)
        enrollments: dict[UUID, list[GroupEnrollmentModel]] = defaultdict(list)
        for item in await self._repository.enrollments():
            if item.athlete_id in users:
                enrollments[item.athlete_id].append(item)
        table: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
        total, in_groups = [0] * len(years), [0] * len(years)
        for user_id in periods.keys() | enrollments.keys():
            user = users[user_id]
            for index, on in enumerate(dates):
                active = [item for item in periods.get(user_id, []) if covers(item.valid_from, item.valid_to, on)]
                groups_on = [item for item in enrollments.get(user_id, []) if covers(item.valid_from, item.valid_to, on)]
                if not active and not groups_on:
                    continue
                total[index] += 1
                in_groups[index] += bool(groups_on)
                for label in self._labels(cut, user, active, groups_on, organizations.get(user_id, []), groups, on):
                    table[label][index] += 1
        rows = [HeadcountRow(label, counts) for label, counts in sorted(table.items(), key=lambda pair: -pair[1][-1])]
        return Headcount(years=years, dates=dates, cut=cut, total=total, in_groups=in_groups,
                         rows=rows if cut != "total" else [])

    def _labels(
        self,
        cut: Cut,
        user: UserModel,
        active: Sequence[AthleteDisciplineModel],
        enrolled: Sequence[GroupEnrollmentModel],
        organizations: Sequence[AthleteOrganizationModel],
        groups: Sequence[DictionaryAgeGroupModel],
        on: date,
    ) -> list[str]:
        """Возвращает ячейки разреза, в которые попадает спортсмен на дату."""
        if cut == "discipline":
            return sorted({item.discipline.name for item in active} | {item.group.discipline.name for item in enrolled})
        if cut == "stage":
            return sorted({TRAINING_STAGE_TITLES[item.group.stage] for item in enrolled}) or [NO_STAGE]
        if cut == "organization":
            if enrolled:
                return sorted({item.group.organization.name for item in enrolled})
            period = next((item for item in organizations if covers(item.valid_from, item.valid_to, on)), None)
            return [period.organization.name if period and period.organization else NO_ORGANIZATION]
        if cut == "age_group":
            age = age_on(user.birth_date, on)
            group = next((item for item in groups if self._fits(item, age)), None)
            return [group.name if group else NO_GROUP]
        if cut == "municipality":
            return [user.municipality.name if user.municipality else NO_MUNICIPALITY]
        return []

    @staticmethod
    def _fits(group: DictionaryAgeGroupModel, age: int) -> bool:
        """Проверяет, что возраст попадает в возрастную группу."""
        return (group.min_age is None or age >= group.min_age) and (group.max_age is None or age <= group.max_age)

    @staticmethod
    def _state(category: QualificationModel | None, now: date) -> CategoryState:
        """Определяет состояние судейской категории: нет, действует, истекает, истекла."""
        if category is None:
            return "none"
        if category.valid_until is None or category.valid_until > now + timedelta(days=EXPIRING_DAYS):
            return "valid"
        return "expiring" if category.valid_until >= now else "expired"
