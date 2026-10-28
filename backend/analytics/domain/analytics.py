from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from analytics.repositories.pg_analytics import (
    AnalyticsRepository,
    ApplicationRow,
    ContestRow,
    Participation,
    ResultRow,
)
from core.errors import ValidationFailed
from infrastructure.enums import CONTEST_STATUS_TITLES, ApplicationStatus, QualificationKind

ZONE = ZoneInfo("Asia/Yekaterinburg")
Block = Literal[
    "summary",
    "participants",
    "contests",
    "applications",
    "retention",
    "demographics",
    "coaches",
    "judges",
    "qualifications",
    "disciplines",
]
BLOCKS: tuple[Block, ...] = (
    "summary",
    "participants",
    "contests",
    "applications",
    "retention",
    "demographics",
    "coaches",
    "judges",
    "qualifications",
    "disciplines",
)
TITLES: dict[Block, str] = {
    "summary": "Сводка",
    "participants": "Участники и новички",
    "contests": "Соревнования",
    "applications": "Заявки",
    "retention": "Удержание",
    "demographics": "Возраст и муниципалитеты",
    "coaches": "Лучшие тренеры",
    "judges": "Нагрузка на судей",
    "qualifications": "Разряды и категории",
    "disciplines": "По дисциплинам",
}
MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZONE).date()


@dataclass(frozen=True, slots=True)
class Period:
    start: date
    end: date

    @property
    def days(self) -> int:
        """Длина периода в днях включительно."""
        return (self.end - self.start).days + 1

    def previous(self) -> "Period":
        """Возвращает предыдущий период такой же длины, примыкающий к началу этого."""
        end = self.start - timedelta(days=1)
        return Period(end - timedelta(days=self.days - 1), end)

    def has(self, day: date) -> bool:
        """Проверяет, входит ли дата в период."""
        return self.start <= day <= self.end

    def months(self) -> list[str]:
        """Возвращает список месяцев периода в формате YYYY-MM."""
        result: list[str] = []
        cursor = self.start.replace(day=1)
        while cursor <= self.end:
            result.append(f"{cursor:%Y-%m}")
            cursor = (cursor + timedelta(days=32)).replace(day=1)
        return result


@dataclass(frozen=True, slots=True)
class Filters:
    discipline_id: int | None = None
    municipality_id: int | None = None
    group_kind: Literal["age", "academic"] | None = None
    group_id: int | None = None


@dataclass(frozen=True, slots=True)
class Query:
    period: Period
    filters: Filters

    @classmethod
    def build(
        cls,
        date_from: date | None,
        date_to: date | None,
        discipline_id: int | None,
        municipality_id: int | None,
        group_kind: Literal["age", "academic"] | None,
        group_id: int | None,
    ) -> "Query":
        """Строит период и фильтры из параметров запроса, проверяя их согласованность."""
        end = date_to or today()
        # По умолчанию — двенадцать месяцев, включая текущий
        month = end.month - 11
        start = date_from or date(end.year + (month - 1) // 12, (month - 1) % 12 + 1, 1)
        if start > end:
            raise ValidationFailed(fields={"date_to": ["Конец периода раньше начала"]})
        if (end - start).days > 3660:
            raise ValidationFailed(fields={"date_from": ["Период не длиннее десяти лет"]})
        if group_id is not None and group_kind is None:
            raise ValidationFailed(fields={"group_kind": ["Укажите вид группы"]})
        return cls(Period(start, end), Filters(discipline_id, municipality_id, group_kind, group_id))


def delta(value: float, previous: float) -> dict[str, Any]:
    """Сравнивает значение с прошлым периодом: разница и процент изменения."""
    diff = value - previous
    pct = round(diff / previous * 100, 1) if previous else None
    return {"value": value, "previous": previous, "diff": round(diff, 1), "pct": pct}


def month_label(month: str) -> str:
    """Превращает «YYYY-MM» в читаемую подпись вида «янв 2024»."""
    year, number = month.split("-")
    return f"{MONTHS[int(number) - 1]} {year}"


def percent(part: int, whole: int) -> float:
    """Доля part от whole в процентах, округлённая до десятых; 0 при пустом whole."""
    return round(part / whole * 100, 1) if whole else 0.0


@dataclass(slots=True)
class Table:
    title: str
    headers: list[str]
    rows: list[list[Any]]
    percent_columns: set[int] = field(default_factory=set)


@dataclass(slots=True)
class Result:
    block: Block
    data: dict[str, Any]
    tables: list[Table]


@dataclass(slots=True)
class Dataset:
    participations: list[Participation]
    contests: list[ContestRow]
    applications: list[ApplicationRow]
    results: list[ResultRow]
    first_seen: dict[UUID, date]


class Analytics:
    """Строит блоки аналитики по хранимым данным об участии, соревнованиях и разрядах."""

    def __init__(self, repository: AnalyticsRepository) -> None:
        """Сохраняет репозиторий аналитики."""
        self._repository = repository

    async def build(self, block: Block, query: Query) -> Result:
        """Строит указанный блок аналитики по запросу."""
        builders: dict[Block, Callable[[Query], Any]] = {
            "summary": self._summary,
            "participants": self._participants,
            "contests": self._contests,
            "applications": self._applications,
            "retention": self._retention,
            "demographics": self._demographics,
            "coaches": self._coaches,
            "judges": self._judges,
            "qualifications": self._qualifications,
            "disciplines": self._disciplines,
        }
        return await builders[block](query)

    async def parameters(self, query: Query) -> list[list[Any]]:
        """Формирует строки таблицы параметров запроса для показа пользователю или экспорта."""
        filters = query.filters
        previous = query.period.previous()
        disciplines = await self._repository.disciplines()
        municipalities = await self._repository.municipalities()
        groups = (
            await self._repository.age_groups()
            if filters.group_kind == "age"
            else await self._repository.academic_groups()
        )
        return [
            ["Период", f"{query.period.start:%d.%m.%Y} — {query.period.end:%d.%m.%Y}"],
            ["Сравнение с", f"{previous.start:%d.%m.%Y} — {previous.end:%d.%m.%Y}"],
            ["Дисциплина", disciplines.get(filters.discipline_id or 0, "Все")],
            ["Муниципалитет", municipalities.get(filters.municipality_id or 0, "Вся область")],
            [
                "Группа",
                groups.get(filters.group_id or 0, "Все")
                + (f" ({'возраст' if filters.group_kind == 'age' else 'учёба'})" if filters.group_id else ""),
            ],
        ]

    async def _dataset(self, filters: Filters, ignore_discipline: bool = False) -> Dataset:
        """Загружает и фильтрует участия, соревнования, заявки и результаты под фильтры запроса."""
        def fits(item: Participation) -> bool:
            """Проверяет, подходит ли участие под фильтры муниципалитета и группы (и дисциплины, если не игнорируем)."""
            if not ignore_discipline and filters.discipline_id and item.discipline_id != filters.discipline_id:
                return False
            if filters.municipality_id and item.municipality_id != filters.municipality_id:
                return False
            if filters.group_id:
                group = item.age_group_id if filters.group_kind == "age" else item.academic_group_id
                if group != filters.group_id:
                    return False
            return True

        participations = [item for item in await self._repository.participations() if fits(item)]
        first_seen: dict[UUID, date] = {}
        for item in participations:
            if item.user_id not in first_seen or item.starts_on < first_seen[item.user_id]:
                first_seen[item.user_id] = item.starts_on
        contests = [
            item
            for item in await self._repository.contests()
            if (ignore_discipline or not filters.discipline_id or item.discipline_id == filters.discipline_id)
            and (not filters.municipality_id or item.municipality_id == filters.municipality_id)
        ]

        def application_fits(item: ApplicationRow) -> bool:
            """Проверяет, есть ли среди членов заявки хоть один подходящий под фильтры муниципалитета и группы."""
            if not ignore_discipline and filters.discipline_id and item.discipline_id != filters.discipline_id:
                return False
            if not filters.municipality_id and not filters.group_id:
                return True
            for municipality_id, age_group_id, academic_group_id in item.members:
                group = age_group_id if filters.group_kind == "age" else academic_group_id
                if (not filters.municipality_id or municipality_id == filters.municipality_id) and (
                    not filters.group_id or group == filters.group_id
                ):
                    return True
            return False

        applications = [item for item in await self._repository.applications() if application_fits(item)]
        keys = {(item.application_id, item.user_id) for item in participations}
        results = [item for item in await self._repository.results() if (item.application_id, item.user_id) in keys]
        return Dataset(participations, contests, applications, results, first_seen)

    @staticmethod
    def _people(data: Dataset, period: Period) -> set[UUID]:
        """Множество участников, выступавших в периоде."""
        return {item.user_id for item in data.participations if period.has(item.starts_on)}

    @staticmethod
    def _newcomers(data: Dataset, period: Period) -> set[UUID]:
        """Множество участников, впервые выступивших в периоде."""
        return {user for user, first in data.first_seen.items() if period.has(first)}

    @staticmethod
    def _starts(data: Dataset, period: Period) -> int:
        """Число уникальных пар «участник-соревнование» в периоде."""
        return len({(item.user_id, item.contest_id) for item in data.participations if period.has(item.starts_on)})

    @staticmethod
    def _kept(data: Dataset, period: Period) -> tuple[float, int, int]:
        """Доля и число участников прошлого периода, выступивших снова в текущем, и база сравнения."""
        before = Analytics._people(data, period.previous())
        now = Analytics._people(data, period)
        kept = len(before & now)
        return percent(kept, len(before)), kept, len(before)

    @staticmethod
    def _decisions(data: Dataset, period: Period) -> Counter[ApplicationStatus]:
        """Считает заявки периода по статусам."""
        return Counter(item.status for item in data.applications if period.has(item.starts_on))

    async def _summary(self, query: Query) -> Result:
        """Строит сводный блок: ключевые показатели периода с сравнением к прошлому."""
        data = await self._dataset(query.filters)
        now, before = query.period, query.period.previous()
        decided_now, decided_before = self._decisions(data, now), self._decisions(data, before)

        def approval(counter: Counter[ApplicationStatus]) -> float:
            """Доля одобренных заявок среди решённых."""
            approved, rejected = counter[ApplicationStatus.APPROVED], counter[ApplicationStatus.REJECTED]
            return percent(approved, approved + rejected)

        qualifications = await self._qualification_rows(query.filters)
        tiles = {
            "participants": delta(len(self._people(data, now)), len(self._people(data, before))),
            "newcomers": delta(len(self._newcomers(data, now)), len(self._newcomers(data, before))),
            "starts": delta(self._starts(data, now), self._starts(data, before)),
            "contests": delta(
                sum(1 for item in data.contests if now.has(item.starts_on)),
                sum(1 for item in data.contests if before.has(item.starts_on)),
            ),
            "approval_rate": delta(approval(decided_now), approval(decided_before)),
            "retention": delta(self._kept(data, now)[0], self._kept(data, before)[0]),
            "qualifications": delta(
                sum(1 for item in qualifications if now.has(item[2])),
                sum(1 for item in qualifications if before.has(item[2])),
            ),
        }
        labels = {
            "participants": "Участники",
            "newcomers": "Новички",
            "starts": "Участия",
            "contests": "Соревнования",
            "approval_rate": "Одобрено заявок, %",
            "retention": "Удержание, %",
            "qualifications": "Разряды и категории",
        }
        rows = [[labels[key], value["value"], value["previous"], value["diff"], value["pct"]] for key, value in tiles.items()]
        return Result(
            "summary",
            {"tiles": tiles},
            [Table("Сводка", ["Показатель", "Период", "Прошлый период", "Разница", "Разница, %"], rows)],
        )

    async def _participants(self, query: Query) -> Result:
        """Строит блок по участникам и новичкам с помесячной динамикой."""
        data = await self._dataset(query.filters)
        months = []
        for month in query.period.months():
            people = {item.user_id for item in data.participations if f"{item.starts_on:%Y-%m}" == month}
            starts = {
                (item.user_id, item.contest_id) for item in data.participations if f"{item.starts_on:%Y-%m}" == month
            }
            newcomers = sum(1 for first in data.first_seen.values() if f"{first:%Y-%m}" == month)
            months.append(
                {"month": month, "label": month_label(month), "participants": len(people), "newcomers": newcomers,
                 "starts": len(starts)}
            )
        now, before = query.period, query.period.previous()
        totals = {
            "participants": delta(len(self._people(data, now)), len(self._people(data, before))),
            "newcomers": delta(len(self._newcomers(data, now)), len(self._newcomers(data, before))),
            "starts": delta(self._starts(data, now), self._starts(data, before)),
        }
        return Result(
            "participants",
            {"months": months, "totals": totals},
            [
                Table(
                    "По месяцам",
                    ["Месяц", "Участники", "Новички", "Участия"],
                    [[item["label"], item["participants"], item["newcomers"], item["starts"]] for item in months],
                ),
                _delta_table(
                    "Итоги",
                    {"Участники": totals["participants"], "Новички": totals["newcomers"], "Участия": totals["starts"]},
                ),
            ],
        )

    async def _contests(self, query: Query) -> Result:
        """Строит блок по соревнованиям: разбивки по уровням, форматам и статусам."""
        data = await self._dataset(query.filters)
        now, before = query.period, query.period.previous()

        def split(key: Callable[[ContestRow], str]) -> list[dict[str, Any]]:
            """Группирует соревнования по key, сравнивая текущий и прошлый период."""
            current = Counter(key(item) for item in data.contests if now.has(item.starts_on))
            previous = Counter(key(item) for item in data.contests if before.has(item.starts_on))
            names = sorted(set(current) | set(previous), key=lambda name: (-current[name], name))
            return [{"name": name, "value": current[name], "previous": previous[name]} for name in names]

        levels = split(lambda item: item.level)
        formats = split(lambda item: item.format)
        statuses = split(lambda item: CONTEST_STATUS_TITLES[item.status])
        total = delta(
            sum(1 for item in data.contests if now.has(item.starts_on)),
            sum(1 for item in data.contests if before.has(item.starts_on)),
        )

        def table(title: str, rows: list[dict[str, Any]]) -> Table:
            """Оформляет разбивку соревнований в таблицу для показа."""
            return Table(
                title,
                ["", "Период", "Прошлый период", "Разница"],
                [[row["name"], row["value"], row["previous"], row["value"] - row["previous"]] for row in rows],
            )

        return Result(
            "contests",
            {"total": total, "levels": levels, "formats": formats, "statuses": statuses},
            [table("По уровням", levels), table("По форматам", formats), table("По статусам", statuses)],
        )

    async def _applications(self, query: Query) -> Result:
        """Строит блок по заявкам: решения по статусам и частые причины отказа."""
        data = await self._dataset(query.filters)
        now, before = query.period, query.period.previous()
        current, previous = self._decisions(data, now), self._decisions(data, before)
        statuses = {
            "approved": ApplicationStatus.APPROVED,
            "rejected": ApplicationStatus.REJECTED,
            "submitted": ApplicationStatus.SUBMITTED,
            "withdrawn": ApplicationStatus.WITHDRAWN,
        }
        counts = {key: delta(current[status], previous[status]) for key, status in statuses.items()}
        reasons: Counter[str] = Counter()
        shown: dict[str, str] = {}
        for item in data.applications:
            if item.status == ApplicationStatus.REJECTED and now.has(item.starts_on) and item.reject_reason:
                key = " ".join(item.reject_reason.lower().replace(".", " ").split())
                reasons[key] += 1
                shown.setdefault(key, item.reject_reason.strip().rstrip("."))
        top = [{"reason": shown[key], "count": count} for key, count in reasons.most_common(10)]
        labels = {"approved": "Одобрено", "rejected": "Отклонено", "submitted": "На рассмотрении", "withdrawn": "Отозвано"}
        return Result(
            "applications",
            {"counts": counts, "reasons": top},
            [
                _delta_table("Решения", {labels[key]: value for key, value in counts.items()}),
                Table("Частые причины отказа", ["Причина", "Заявок"], [[row["reason"], row["count"]] for row in top]),
            ],
        )

    async def _retention(self, query: Query) -> Result:
        """Строит блок удержания: доля вернувшихся участников и когорты по месяцу первого участия."""
        data = await self._dataset(query.filters)
        rate, kept, base = self._kept(data, query.period)
        previous_rate = self._kept(data, query.period.previous())[0]
        by_user: dict[UUID, list[date]] = defaultdict(list)
        for item in data.participations:
            by_user[item.user_id].append(item.starts_on)
        cohorts = []
        for month in query.period.months():
            members = [user for user, first in data.first_seen.items() if f"{first:%Y-%m}" == month]
            if not members:
                continue
            row: dict[str, Any] = {"month": month, "label": month_label(month), "size": len(members)}
            for horizon in (1, 3, 6):
                returned = 0
                for user in members:
                    first = data.first_seen[user]
                    limit = first + timedelta(days=30 * horizon)
                    if any(first < day <= limit for day in by_user[user]):
                        returned += 1
                row[f"m{horizon}"] = percent(returned, len(members))
            cohorts.append(row)
        return Result(
            "retention",
            {"rate": delta(rate, previous_rate), "kept": kept, "base": base, "cohorts": cohorts},
            [
                Table(
                    "Удержание",
                    ["Участников прошлого периода", "Выступили снова", "Удержание, %", "Прошлый период, %"],
                    [[base, kept, rate, previous_rate]],
                    {2, 3},
                ),
                Table(
                    "Когорты по месяцу первого участия",
                    ["Месяц", "Новичков", "Вернулись за 1 мес., %", "За 3 мес., %", "За 6 мес., %"],
                    [[row["label"], row["size"], row["m1"], row["m3"], row["m6"]] for row in cohorts],
                    {2, 3, 4},
                ),
            ],
        )

    async def _demographics(self, query: Query) -> Result:
        """Строит блок демографии: распределение участников по муниципалитетам и группам."""
        data = await self._dataset(query.filters)
        now, before = query.period, query.period.previous()
        municipalities = await self._repository.municipalities()
        age_groups = await self._repository.age_groups()
        academic_groups = await self._repository.academic_groups()

        def unique(period: Period, key: Callable[[Participation], int | None]) -> Counter[int | None]:
            """Считает уникальных участников периода по значению key, взятому при первом появлении."""
            seen: dict[UUID, int | None] = {}
            for item in data.participations:
                if period.has(item.starts_on):
                    seen.setdefault(item.user_id, key(item))
            return Counter(seen.values())

        def rows(counter_now: Counter[int | None], counter_before: Counter[int | None], names: dict[int, str],
                 empty: str, top: int | None = None) -> list[dict[str, Any]]:
            """Оформляет распределение в список строк, при необходимости сворачивая хвост в «Другие»."""
            ordered = sorted(counter_now.items(), key=lambda pair: -pair[1])
            result = [
                {"name": names.get(key, empty) if key is not None else empty, "value": value,
                 "previous": counter_before.get(key, 0)}
                for key, value in ordered
            ]
            if top is not None and len(result) > top:
                rest = result[top:]
                result = result[:top] + [
                    {"name": "Другие", "value": sum(row["value"] for row in rest),
                     "previous": sum(row["previous"] for row in rest)}
                ]
            return result

        municipality = rows(
            unique(now, lambda item: item.municipality_id), unique(before, lambda item: item.municipality_id),
            municipalities, "Не указан", 10,
        )
        ages = rows(
            unique(now, lambda item: item.age_group_id), unique(before, lambda item: item.age_group_id),
            age_groups, "Без группы",
        )
        academic = rows(
            unique(now, lambda item: item.academic_group_id), unique(before, lambda item: item.academic_group_id),
            academic_groups, "Не указана",
        )

        def table(title: str, items: list[dict[str, Any]]) -> Table:
            """Оформляет распределение участников в таблицу для показа."""
            return Table(title, ["", "Участников", "Прошлый период"], [[row["name"], row["value"], row["previous"]] for row in items])

        return Result(
            "demographics",
            {"municipalities": municipality, "ages": ages, "academic": academic},
            [table("Муниципалитеты", municipality), table("Возрастные группы", ages), table("Академические группы", academic)],
        )

    async def _coaches(self, query: Query) -> Result:
        """Строит рейтинг тренеров по баллам, участникам и призовым местам подопечных."""
        data = await self._dataset(query.filters)
        now, before = query.period, query.period.previous()
        coach_of = {(item.application_id, item.user_id): item.coach_id for item in data.participations if item.coach_id}

        def collect(period: Period) -> dict[UUID, dict[str, Any]]:
            """Собирает статистику тренеров (подопечные, участия, баллы, призовые места) за период."""
            stats: dict[UUID, dict[str, Any]] = defaultdict(
                lambda: {"points": 0, "athletes": set(), "starts": set(), "podiums": 0}
            )
            for item in data.participations:
                if item.coach_id and period.has(item.starts_on):
                    stats[item.coach_id]["athletes"].add(item.user_id)
                    stats[item.coach_id]["starts"].add((item.user_id, item.contest_id))
            for result in data.results:
                coach = coach_of.get((result.application_id, result.user_id))
                if coach and period.has(result.starts_on):
                    stats[coach]["points"] += result.points
                    if result.place is not None and result.place <= 3:
                        stats[coach]["podiums"] += 1
            return stats

        current, previous = collect(now), collect(before)
        ranked = sorted(current.items(), key=lambda pair: (-pair[1]["points"], -len(pair[1]["athletes"])))[:20]
        names = await self._repository.names([coach for coach, _ in ranked])
        items = [
            {
                "id": str(coach),
                "name": names.get(coach, "—"),
                "points": stats["points"],
                "previous_points": previous.get(coach, {}).get("points", 0),
                "athletes": len(stats["athletes"]),
                "starts": len(stats["starts"]),
                "podiums": stats["podiums"],
            }
            for coach, stats in ranked
        ]
        total = delta(sum(item["points"] for item in current.values()), sum(item["points"] for item in previous.values()))
        return Result(
            "coaches",
            {"items": items, "total_points": total},
            [
                Table(
                    "Лучшие тренеры по баллам подопечных",
                    ["Место", "Тренер", "Баллы", "Прошлый период", "Подопечные", "Участия", "Призовые места"],
                    [
                        [index + 1, row["name"], row["points"], row["previous_points"], row["athletes"], row["starts"],
                         row["podiums"]]
                        for index, row in enumerate(items)
                    ],
                )
            ],
        )

    async def _judges(self, query: Query) -> Result:
        """Строит блок нагрузки судей: соревнования, дни, роль главного судьи и состав коллегий."""
        filters = query.filters
        now, before = query.period, query.period.previous()
        assignments = [
            item
            for item in await self._repository.assignments()
            if not filters.discipline_id or item.discipline_id == filters.discipline_id
        ]
        data = await self._dataset(Filters(discipline_id=filters.discipline_id, municipality_id=filters.municipality_id))
        contests_now = {item.id for item in data.contests if now.has(item.starts_on) }
        contests_before = {item.id for item in data.contests if before.has(item.starts_on)}
        judges: dict[UUID, dict[str, Any]] = defaultdict(lambda: {"contests": set(), "days": 0, "chief": 0})
        panels: dict[int, set[UUID]] = defaultdict(set)
        for item in assignments:
            if item.contest_id not in contests_now:
                continue
            panels[item.contest_id].add(item.judge_id)
            stats = judges[item.judge_id]
            if item.contest_id not in stats["contests"]:
                stats["contests"].add(item.contest_id)
                stats["days"] += (item.ends_on - item.starts_on).days + 1
            if "главн" in item.position.lower():
                stats["chief"] += 1
        panels_before: dict[int, set[UUID]] = defaultdict(set)
        for item in assignments:
            if item.contest_id in contests_before:
                panels_before[item.contest_id].add(item.judge_id)
        names = await self._repository.names(list(judges))
        categories = await self._repository.judge_categories()
        items = sorted(
            (
                {
                    "id": str(judge),
                    "name": names.get(judge, "—"),
                    "category": categories.get(judge),
                    "contests": len(stats["contests"]),
                    "days": stats["days"],
                    "chief": stats["chief"],
                }
                for judge, stats in judges.items()
            ),
            key=lambda row: (-row["contests"], -row["days"], row["name"]),
        )
        average = round(sum(len(value) for value in panels.values()) / len(contests_now), 1) if contests_now else 0.0
        average_before = (
            round(sum(len(value) for value in panels_before.values()) / len(contests_before), 1) if contests_before else 0.0
        )
        without = len(contests_now - set(panels))
        without_before = len(contests_before - set(panels_before))
        return Result(
            "judges",
            {
                "items": items,
                "average": delta(average, average_before),
                "without_panel": delta(without, without_before),
                "judges": delta(len(judges), len({judge for value in panels_before.values() for judge in value})),
            },
            [
                Table(
                    "Нагрузка на судей",
                    ["Судья", "Категория", "Соревнований", "Дней", "Главным судьёй"],
                    [[row["name"], row["category"] or "—", row["contests"], row["days"], row["chief"]] for row in items],
                ),
                _delta_table(
                    "Коллегии",
                    {
                        "Судей в среднем на соревнование": delta(average, average_before),
                        "Соревнований без коллегии": delta(without, without_before),
                    },
                ),
            ],
        )

    async def _qualification_rows(self, filters: Filters) -> list[tuple[QualificationKind, str, date]]:
        """Возвращает присвоенные разряды и категории, отфильтрованные по муниципалитету."""
        return [
            (item.kind, item.name, item.decided_at.astimezone(ZONE).date())
            for item in await self._repository.qualifications()
            if not filters.municipality_id or item.municipality_id == filters.municipality_id
        ]

    async def _qualifications(self, query: Query) -> Result:
        """Строит блок разрядов и категорий: помесячная динамика и разбивка по названиям."""
        rows = await self._qualification_rows(query.filters)
        now, before = query.period, query.period.previous()
        months = []
        for month in now.months():
            in_month = [row for row in rows if f"{row[2]:%Y-%m}" == month]
            months.append(
                {
                    "month": month,
                    "label": month_label(month),
                    "ranks": sum(1 for row in in_month if row[0] == QualificationKind.RANK),
                    "categories": sum(1 for row in in_month if row[0] == QualificationKind.JUDGE_CATEGORY),
                }
            )
        by_name = Counter((row[0], row[1]) for row in rows if now.has(row[2]))
        names = [
            {"kind": kind.value, "name": name, "value": value}
            for (kind, name), value in sorted(by_name.items(), key=lambda pair: -pair[1])
        ]

        def count(period: Period, kind: QualificationKind) -> int:
            """Считает присвоения вида kind в периоде."""
            return sum(1 for row in rows if row[0] == kind and period.has(row[2]))

        totals = {
            "ranks": delta(count(now, QualificationKind.RANK), count(before, QualificationKind.RANK)),
            "categories": delta(
                count(now, QualificationKind.JUDGE_CATEGORY), count(before, QualificationKind.JUDGE_CATEGORY)
            ),
        }
        return Result(
            "qualifications",
            {"months": months, "by_name": names, "totals": totals},
            [
                Table(
                    "По месяцам",
                    ["Месяц", "Разряды", "Судейские категории"],
                    [[row["label"], row["ranks"], row["categories"]] for row in months],
                ),
                Table(
                    "По видам",
                    ["Вид", "Название", "Присвоено"],
                    [["Разряд" if row["kind"] == "rank" else "Категория", row["name"], row["value"]] for row in names],
                ),
                _delta_table("Итоги", {"Разряды": totals["ranks"], "Судейские категории": totals["categories"]}),
            ],
        )

    async def _disciplines(self, query: Query) -> Result:
        """Строит блок по дисциплинам: участники, заявки, одобрение и баллы по каждой."""
        data = await self._dataset(query.filters, ignore_discipline=True)
        now, before = query.period, query.period.previous()
        disciplines = await self._repository.disciplines()

        def metrics(discipline_id: int, period: Period) -> dict[str, int]:
            """Собирает показатели дисциплины за период."""
            part = [item for item in data.participations if item.discipline_id == discipline_id and period.has(item.starts_on)]
            first: dict[UUID, date] = {}
            for item in data.participations:
                if item.discipline_id == discipline_id and (item.user_id not in first or item.starts_on < first[item.user_id]):
                    first[item.user_id] = item.starts_on
            applications = [
                item for item in data.applications if item.discipline_id == discipline_id and period.has(item.starts_on)
            ]
            return {
                "participants": len({item.user_id for item in part}),
                "newcomers": sum(1 for day in first.values() if period.has(day)),
                "contests": sum(1 for item in data.contests if item.discipline_id == discipline_id and period.has(item.starts_on)),
                "applications": len(applications),
                "approved": sum(1 for item in applications if item.status == ApplicationStatus.APPROVED),
                "points": sum(
                    item.points for item in data.results if item.discipline_id == discipline_id and period.has(item.starts_on)
                ),
            }

        items = []
        for discipline_id, name in sorted(disciplines.items(), key=lambda pair: pair[1]):
            if query.filters.discipline_id and discipline_id != query.filters.discipline_id:
                continue
            current, previous = metrics(discipline_id, now), metrics(discipline_id, before)
            if not any(current.values()) and not any(previous.values()):
                continue
            items.append({"id": discipline_id, "name": name, **{key: delta(current[key], previous[key]) for key in current}})
        items.sort(key=lambda row: -row["participants"]["value"])
        headers = ["Дисциплина"]
        keys = ["participants", "newcomers", "contests", "applications", "approved", "points"]
        titles = ["Участники", "Новички", "Соревнования", "Заявки", "Одобрено", "Баллы"]
        for title in titles:
            headers += [title, f"{title}: прошлый", f"{title}: разница, %"]
        rows = []
        for row in items:
            line: list[Any] = [row["name"]]
            for key in keys:
                line += [row[key]["value"], row[key]["previous"], row[key]["pct"]]
            rows.append(line)
        return Result(
            "disciplines",
            {"items": items},
            [Table("По дисциплинам", headers, rows, {3 + index * 3 for index in range(len(keys))})],
        )


def _delta_table(title: str, values: dict[str, dict[str, Any]]) -> Table:
    """Оформляет набор показателей delta() в таблицу «период / прошлый период / разница»."""
    return Table(
        title,
        ["Показатель", "Период", "Прошлый период", "Разница", "Разница, %"],
        [[name, value["value"], value["previous"], value["diff"], value["pct"]] for name, value in values.items()],
        {4},
    )


def all_blocks() -> Iterable[Block]:
    """Возвращает все блоки аналитики в порядке показа."""
    return BLOCKS
