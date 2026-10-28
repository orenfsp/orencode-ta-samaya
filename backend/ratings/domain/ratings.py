from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from applications.domain.eligibility import Eligibility
from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import NotFound, ValidationFailed
from dictionaries.domain.dictionaries import Dictionary
from infrastructure.account.user import UserModel
from infrastructure.base import DictionaryColumns
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import RATING_SEASON_TITLES, RatingSeason, VerificationStatus
from infrastructure.participation.rating_setting import RatingSettingModel
from ratings.repositories.pg_ratings import RatingRepository

GroupKind = Literal["age", "academic"]


@dataclass(frozen=True, slots=True)
class Rules:
    factor: Decimal = Decimal("1.2")
    podium_place: int = 3
    podium_count: int = 2
    season: RatingSeason = RatingSeason.ROLLING

    @property
    def factor_text(self) -> str:
        """Коэффициент в записи с запятой: «1,2»."""
        return format(self.factor.normalize(), "f").replace(".", ",")

    @property
    def formula(self) -> str:
        """Правило подсчёта одной фразой для страницы рейтинга."""
        return (
            f"Сумма баллов за места на верифицированных соревнованиях за период «{RATING_SEASON_TITLES[self.season].lower()}». "
            f"Призёрам (места 1–{self.podium_place}) не менее чем {self.podium_count} соревнований итог умножается на {self.factor_text}"
        )


@dataclass(slots=True)
class Score:
    contest_id: int
    title: str
    ends_on: date
    place: int | None
    points: int


@dataclass(frozen=True, slots=True)
class Total:
    points: int
    contests: int
    base: int
    podiums: int
    factor: Decimal | None
    explain: str


@dataclass(slots=True)
class Line:
    place: int
    user: UserModel
    points: int
    contests: int
    base: int = 0
    podiums: int = 0
    factor: Decimal | None = None
    explain: str = ""


@dataclass(slots=True)
class Board:
    discipline: DictionaryColumns
    kind: GroupKind
    group: DictionaryColumns
    lines: list[Line]


@dataclass(slots=True)
class Standing:
    board: Board
    line: Line
    scores: list[Score] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class Reason:
    code: str
    text: str


@dataclass(slots=True)
class Status:
    rules: Rules
    since: date
    standings: list[Standing]
    reasons: list[Reason]


@dataclass(slots=True)
class _Pool:
    users: dict[UUID, UserModel]
    totals: dict[tuple[int, UUID], Total]
    scores: dict[tuple[int, UUID], list[Score]]


class Ratings:
    """Домен рейтингов спортсменов: баллы за сезон по правилам федерации, по возрастным и академическим группам."""

    KINDS: tuple[GroupKind, ...] = ("age", "academic")

    def __init__(self, ratings: RatingRepository, dictionary: Dictionary, uow: UnitOfWork, audit: Audit) -> None:
        """Сохраняет зависимости."""
        self._ratings = ratings
        self._dictionary = dictionary
        self._uow, self._audit = uow, audit

    @staticmethod
    def today() -> date:
        """Возвращает текущую дату по Оренбургу."""
        return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()

    @staticmethod
    def since(today: date, season: RatingSeason = RatingSeason.ROLLING) -> date:
        """Возвращает первый день сезона: 365 дней назад или 1 января текущего года."""
        return date(today.year, 1, 1) if season == RatingSeason.CALENDAR else today - timedelta(days=365)

    @staticmethod
    def total(scores: Sequence[Score], rules: Rules) -> Total:
        """Считает итог спортсмена: сумма баллов, ×коэффициент призёру нужного числа соревнований, и строку объяснения."""
        ordered = sorted(scores, key=lambda score: (score.ends_on, score.contest_id))
        base = sum(score.points for score in ordered)
        podiums = sum(1 for score in ordered if score.place is not None and score.place <= rules.podium_place)
        factor = rules.factor if podiums >= rules.podium_count and rules.factor != 1 else None
        points = int((Decimal(base) * factor).quantize(Decimal(1), ROUND_HALF_UP)) if factor else base
        parts = " + ".join(str(score.points) for score in ordered)
        explain = parts if len(ordered) == 1 else f"{parts} = {base}"
        if factor:
            explain += f" × {rules.factor_text} = {points}"
        return Total(points, len(ordered), base, podiums, factor, explain)

    @staticmethod
    def ranked(lines: Sequence[Line]) -> list[Line]:
        """Сортирует строки по итогу и назначает места с учётом равенства баллов."""
        ordered = sorted(lines, key=lambda line: (-line.points, line.user.last_name, line.user.first_name))
        for index, line in enumerate(ordered):
            line.place = ordered[index - 1].place if index and ordered[index - 1].points == line.points else index + 1
        return ordered

    async def rules(self) -> Rules:
        """Возвращает действующие правила рейтинга; если федерация их не меняла — по умолчанию."""
        item = await self._ratings.settings()
        if item is None:
            return Rules()
        return Rules(Decimal(item.stability_factor), item.podium_place, item.podium_count, item.season)

    async def save_rules(self, actor_id: UUID, rules: Rules, ip: str | None) -> Rules:
        """Сохраняет правила рейтинга федерации и пишет изменение в журнал."""
        errors: dict[str, list[str]] = {}
        if not Decimal(1) <= rules.factor <= Decimal(3):
            errors["stability_factor"] = ["Коэффициент — от 1 до 3"]
        if not 1 <= rules.podium_place <= 10:
            errors["podium_place"] = ["Призовые места — с 1 по 10"]
        if not 1 <= rules.podium_count <= 10:
            errors["podium_count"] = ["Число соревнований — от 1 до 10"]
        if errors:
            raise ValidationFailed(fields=errors)
        before = await self.rules()
        item = await self._ratings.settings()
        if item is None:
            item = RatingSettingModel(id=1)
            self._ratings.add_settings(item)
        item.stability_factor, item.podium_place, item.podium_count = rules.factor, rules.podium_place, rules.podium_count
        item.season, item.updated_by = rules.season, actor_id
        changes = {
            name: [str(getattr(before, name)), str(getattr(rules, name))]
            for name in ("factor", "podium_place", "podium_count", "season")
            if getattr(before, name) != getattr(rules, name)
        }
        await self._audit.write(AuditAction.RATING_SETTINGS_SAVE, actor_id, "rating_settings", None, changes, ip)
        await self._uow.commit()
        return rules

    async def boards(
        self, discipline_id: int | None, municipality_id: int | None, kind: GroupKind | None = None, min_rank_id: int | None = None
    ) -> list[Board]:
        """Возвращает все непустые рейтинговые таблицы по дисциплинам и группам с фильтрами."""
        today = self.today()
        pool = await self._pool(today, discipline_id)
        allowed = await self._allowed(pool, today, min_rank_id)
        groups = await self._groups()
        result: list[Board] = []
        for discipline in await self._disciplines(discipline_id):
            for current in (kind,) if kind else self.KINDS:
                for group in groups[current]:
                    board = self._board(pool, today, groups, discipline, current, group, municipality_id, allowed)
                    if board.lines:
                        result.append(board)
        return result

    async def board(
        self, discipline_id: int, kind: GroupKind, group_id: int, municipality_id: int | None, min_rank_id: int | None = None
    ) -> Board:
        """Возвращает рейтинговую таблицу по дисциплине и группе."""
        board, _ = await self.standings(discipline_id, kind, group_id, municipality_id, min_rank_id)
        return board

    async def standings(
        self, discipline_id: int, kind: GroupKind, group_id: int, municipality_id: int | None = None, min_rank_id: int | None = None
    ) -> tuple[Board, dict[UUID, list[Score]]]:
        """Возвращает рейтинговую таблицу и историю результатов каждого участника."""
        today = self.today()
        groups = await self._groups()
        discipline = next(iter(await self._disciplines(discipline_id)), None)
        group = next((item for item in groups[kind] if item.id == group_id), None)
        if discipline is None or group is None:
            raise NotFound()
        pool = await self._pool(today, discipline_id)
        allowed = await self._allowed(pool, today, min_rank_id)
        board = self._board(pool, today, groups, discipline, kind, group, municipality_id, allowed)
        return board, {line.user.id: pool.scores[(discipline.id, line.user.id)] for line in board.lines}

    async def athlete(self, user_id: UUID) -> list[Standing]:
        """Возвращает положение спортсмена во всех рейтингах, где он есть, по каждой дисциплине и виду группы."""
        today = self.today()
        rules = await self.rules()
        own = await self._ratings.scores(self.since(today, rules.season), user_id=user_id)
        if not own:
            return []
        groups = await self._groups()
        result: list[Standing] = []
        for discipline in await self._disciplines(None):
            if not any(row[1] == discipline.id for row in own):
                continue
            pool = await self._pool(today, discipline.id, rules)
            user = pool.users.get(user_id)
            if user is None:
                continue
            for kind in self.KINDS:
                group = self._current(user, today, groups, kind)
                if group is None:
                    continue
                board = self._board(pool, today, groups, discipline, kind, group, None, None)
                line = next((line for line in board.lines if line.user.id == user_id), None)
                if line is not None:
                    result.append(Standing(board=board, line=line, scores=pool.scores[(discipline.id, user_id)]))
        return result

    async def status(self, user_id: UUID) -> Status:
        """Объясняет спортсмену его место в рейтингах или почему его там нет."""
        user = (await self._ratings.users([user_id])).get(user_id)
        if user is None:
            raise NotFound()
        today = self.today()
        rules = await self.rules()
        since = self.since(today, rules.season)
        standings = await self.athlete(user.id)
        reasons: list[Reason] = []
        results = await self._ratings.season_results(user.id, since)
        unverified = sorted({title for title, state, _ in results if state != VerificationStatus.VERIFIED})
        if not any(state == VerificationStatus.VERIFIED for _, state, _ in results):
            reasons.append(Reason("no_verified", "За сезон нет мест на соревнованиях, верифицированных федерацией: рейтинг считается только по ним"))
        if unverified:
            reasons.append(Reason("unverified", "Не идут в рейтинг — соревнования без верификации федерации: " + "; ".join(unverified)))
        awaiting = await self._ratings.awaiting(user.id, since)
        if awaiting:
            reasons.append(Reason("no_places", "Организатор ещё не внёс места: " + "; ".join(awaiting)))
        until = (await self._ratings.suspended(today)).get(user.id)
        if until:
            reasons.insert(0, Reason("suspended", f"Отстранение решением федерации до {until.strftime('%d.%m.%Y')}: на это время нет в рейтинге и сборной"))
        groups = await self._groups()
        if self._current(user, today, groups, "age") is None:
            age = Eligibility.age_on(user.birth_date, today)
            reasons.append(Reason("no_age_group", f"Возраст {age} лет не попадает ни в одну возрастную группу — нет в рейтингах по возрасту"))
        if self._current(user, today, groups, "academic") is None:
            reasons.append(Reason("no_academic_group", "Не указана академическая группа — нет в рейтингах по учёбе. Её можно указать в настройках профиля"))
        return Status(rules=rules, since=since, standings=standings, reasons=reasons)

    def _board(
        self,
        pool: _Pool,
        today: date,
        groups: dict[GroupKind, list[DictionaryColumns]],
        discipline: DictionaryColumns,
        kind: GroupKind,
        group: DictionaryColumns,
        municipality_id: int | None,
        allowed: set[UUID] | None,
    ) -> Board:
        """Собирает рейтинговую таблицу по дисциплине и группе из пула подсчитанных итогов."""
        members = [
            Line(0, user, total.points, total.contests, total.base, total.podiums, total.factor, total.explain)
            for user in pool.users.values()
            if (total := pool.totals.get((discipline.id, user.id))) is not None
            and (municipality_id is None or user.municipality_id == municipality_id)
            and (allowed is None or user.id in allowed)
            and (current := self._current(user, today, groups, kind)) is not None
            and current.id == group.id
        ]
        return Board(discipline=discipline, kind=kind, group=group, lines=self.ranked(members))

    async def _pool(self, today: date, discipline_id: int | None, rules: Rules | None = None) -> _Pool:
        """Загружает результаты за сезон и считает итоги участников по дисциплинам."""
        rules = rules or await self.rules()
        rows = await self._ratings.scores(self.since(today, rules.season), discipline_id=discipline_id)
        suspended = await self._ratings.suspended(today)
        users = {key: user for key, user in (await self._ratings.users(list({row[0] for row in rows}))).items() if key not in suspended}
        scores: dict[tuple[int, UUID], list[Score]] = {}
        for user_id, discipline, contest_id, title, ends_on, place, points in rows:
            if user_id in users:
                scores.setdefault((discipline, user_id), []).append(Score(contest_id, title, ends_on, place, points))
        totals = {key: self.total(items, rules) for key, items in scores.items()}
        return _Pool(users=users, totals=totals, scores=scores)

    async def _allowed(self, pool: _Pool, today: date, min_rank_id: int | None) -> set[UUID] | None:
        """Возвращает людей с разрядом не ниже указанного; None — фильтра нет. Выше в справочнике — выше ступень."""
        if min_rank_id is None:
            return None
        ranks = await self._ratings.ranks(list(pool.users), today)
        return {user_id for user_id, rank_id in ranks.items() if rank_id <= min_rank_id}

    async def _groups(self) -> dict[GroupKind, list[DictionaryColumns]]:
        """Возвращает неархивные возрастные и академические группы из справочников."""
        return {
            "age": list(await self._dictionary.list("age_groups", include_archived=False)),
            "academic": list(await self._dictionary.list("academic_groups", include_archived=False)),
        }

    async def _disciplines(self, discipline_id: int | None) -> list[DictionaryColumns]:
        """Возвращает дисциплины из справочника, при указании id — только её."""
        items = await self._dictionary.list("disciplines", include_archived=True)
        return [item for item in items if discipline_id is None or item.id == discipline_id]

    @staticmethod
    def _current(
        user: UserModel, today: date, groups: dict[GroupKind, list[DictionaryColumns]], kind: GroupKind
    ) -> DictionaryColumns | None:
        """Определяет текущую возрастную или академическую группу пользователя."""
        if kind == "academic":
            return next((group for group in groups["academic"] if group.id == user.academic_group_id), None)
        age = Eligibility.age_on(user.birth_date, today)
        return next(
            (
                group
                for group in groups["age"]
                if isinstance(group, DictionaryAgeGroupModel) and Eligibility.age_fits(group, age)
            ),
            None,
        )
