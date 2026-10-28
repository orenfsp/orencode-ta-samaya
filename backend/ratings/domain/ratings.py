from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from applications.domain.eligibility import Eligibility
from core.errors import NotFound
from dictionaries.domain.dictionaries import Dictionary
from infrastructure.base import DictionaryColumns
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.account.user import UserModel
from ratings.repositories.pg_ratings import RatingRepository

GroupKind = Literal["age", "academic"]


@dataclass(slots=True)
class Score:
    contest_id: int
    title: str
    ends_on: date
    place: int | None
    points: int


@dataclass(slots=True)
class Line:
    place: int
    user: UserModel
    points: int
    contests: int


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


@dataclass(slots=True)
class _Pool:
    users: dict[UUID, UserModel]
    totals: dict[tuple[int, UUID], int]
    scores: dict[tuple[int, UUID], list[Score]]


class Ratings:
    """Домен рейтингов спортсменов: подсчёт баллов за последний год по возрастным и академическим группам."""

    WINDOW_DAYS = 365
    KINDS: tuple[GroupKind, ...] = ("age", "academic")

    def __init__(self, ratings: RatingRepository, dictionary: Dictionary) -> None:
        """Сохраняет зависимости."""
        self._ratings = ratings
        self._dictionary = dictionary

    @staticmethod
    def today() -> date:
        """Возвращает текущую дату по Оренбургу."""
        return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()

    @classmethod
    def since(cls, today: date) -> date:
        """Возвращает дату начала окна учёта рейтинга (год до указанной даты)."""
        return today - timedelta(days=cls.WINDOW_DAYS)

    @staticmethod
    def ranked(items: Sequence[tuple[UserModel, int, int]]) -> list[Line]:
        """Сортирует участников по баллам и назначает места с учётом равенства баллов."""
        ordered = sorted(items, key=lambda item: (-item[1], item[0].last_name, item[0].first_name))
        lines: list[Line] = []
        for index, (user, points, contests) in enumerate(ordered):
            place = lines[-1].place if lines and lines[-1].points == points else index + 1
            lines.append(Line(place=place, user=user, points=points, contests=contests))
        return lines

    async def boards(
        self, discipline_id: int | None, municipality_id: int | None, kind: GroupKind | None = None
    ) -> list[Board]:
        """Возвращает все непустые рейтинговые таблицы по дисциплинам и группам, опционально отфильтрованные по виду группы."""
        today = self.today()
        pool = await self._pool(today, discipline_id)
        groups = await self._groups()
        result: list[Board] = []
        for discipline in await self._disciplines(discipline_id):
            for current in (kind,) if kind else self.KINDS:
                for group in groups[current]:
                    board = self._board(pool, today, groups, discipline, current, group, municipality_id)
                    if board.lines:
                        result.append(board)
        return result

    async def board(
        self, discipline_id: int, kind: GroupKind, group_id: int, municipality_id: int | None
    ) -> Board:
        """Возвращает рейтинговую таблицу по конкретной дисциплине и группе."""
        today = self.today()
        groups = await self._groups()
        discipline = next(iter(await self._disciplines(discipline_id)), None)
        group = next((item for item in groups[kind] if item.id == group_id), None)
        if discipline is None or group is None:
            raise NotFound()
        pool = await self._pool(today, discipline_id)
        return self._board(pool, today, groups, discipline, kind, group, municipality_id)

    async def standings(self, discipline_id: int, kind: GroupKind, group_id: int) -> tuple[Board, dict[UUID, list[Score]]]:
        """Возвращает рейтинговую таблицу и историю результатов каждого участника."""
        today = self.today()
        groups = await self._groups()
        discipline = next(iter(await self._disciplines(discipline_id)), None)
        group = next((item for item in groups[kind] if item.id == group_id), None)
        if discipline is None or group is None:
            raise NotFound()
        pool = await self._pool(today, discipline_id)
        board = self._board(pool, today, groups, discipline, kind, group, None)
        return board, {line.user.id: pool.scores[(discipline.id, line.user.id)] for line in board.lines}

    async def athlete(self, user_id: UUID) -> list[Standing]:
        """Возвращает положение спортсмена во всех рейтингах, где он есть, по каждой дисциплине и виду группы."""
        today = self.today()
        own = await self._ratings.scores(self.since(today), user_id=user_id)
        if not own:
            return []
        groups = await self._groups()
        result: list[Standing] = []
        for discipline in await self._disciplines(None):
            if not any(row[1] == discipline.id for row in own):
                continue
            pool = await self._pool(today, discipline.id)
            user = pool.users.get(user_id)
            if user is None:
                continue
            for kind in self.KINDS:
                group = self._current(user, today, groups, kind)
                if group is None:
                    continue
                board = self._board(pool, today, groups, discipline, kind, group, None)
                line = next((line for line in board.lines if line.user.id == user_id), None)
                if line is not None:
                    result.append(Standing(board=board, line=line, scores=pool.scores[(discipline.id, user_id)]))
        return result

    def _board(
        self,
        pool: _Pool,
        today: date,
        groups: dict[GroupKind, list[DictionaryColumns]],
        discipline: DictionaryColumns,
        kind: GroupKind,
        group: DictionaryColumns,
        municipality_id: int | None,
    ) -> Board:
        """Собирает рейтинговую таблицу по дисциплине и группе из пула подсчитанных баллов."""
        members = [
            (user, pool.totals[(discipline.id, user.id)], len(pool.scores[(discipline.id, user.id)]))
            for user in pool.users.values()
            if (discipline.id, user.id) in pool.totals
            and (municipality_id is None or user.municipality_id == municipality_id)
            and (current := self._current(user, today, groups, kind)) is not None
            and current.id == group.id
        ]
        return Board(discipline=discipline, kind=kind, group=group, lines=self.ranked(members))

    async def _pool(self, today: date, discipline_id: int | None) -> _Pool:
        """Загружает результаты за окно рейтинга и суммирует баллы участников по дисциплинам."""
        rows = await self._ratings.scores(self.since(today), discipline_id=discipline_id)
        users = await self._ratings.users(list({row[0] for row in rows}))
        totals: dict[tuple[int, UUID], int] = {}
        scores: dict[tuple[int, UUID], list[Score]] = {}
        for user_id, discipline, contest_id, title, ends_on, place, points in rows:
            if user_id not in users:
                continue
            key = (discipline, user_id)
            totals[key] = totals.get(key, 0) + points
            scores.setdefault(key, []).append(Score(contest_id, title, ends_on, place, points))
        return _Pool(users=users, totals=totals, scores=scores)

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
