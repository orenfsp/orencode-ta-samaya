from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from datetime import date
from typing import Any
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.config import Settings
from core.database import UnitOfWork
from core.errors import AppError, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.domain.files import PDF, Files
from infrastructure.base import DictionaryColumns
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.squads.squad import SquadModel
from infrastructure.squads.squad_member import SquadMemberModel
from notifications.domain.notifications import Notifications
from people.domain.people import full_name
from ratings.domain.ratings import GroupKind, Line, Ratings, Score
from squads.repositories.pg_squads import SquadRepository


class NoCandidates(AppError):
    status_code = 409
    code = "no_candidates"
    message = "В рейтинге этой группы пока никого нет"


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT.parent / "documents" / "assets"
ORDER_TEMPLATES = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))


@dataclass(frozen=True, slots=True)
class Pick:
    line: Line
    is_reserve: bool


@dataclass(frozen=True, slots=True)
class Draft:
    discipline: DictionaryDisciplineModel
    kind: GroupKind
    group: DictionaryColumns
    main_size: int
    reserve_size: int
    available: int
    picks: list[Pick]
    current: SquadModel | None
    excluded: list[Line] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class SquadForm:
    discipline_id: int
    group_kind: GroupKind
    group_id: int
    main_size: int
    reserve_size: int
    order_number: str
    order_date: date
    order_file_id: UUID
    min_rank_id: int | None = None
    exclude_ids: tuple[UUID, ...] = ()


class Squads:
    """Домен сборных команд: формирование состава по рейтингу, утверждение и расформирование приказом."""

    def __init__(
        self,
        uow: UnitOfWork,
        squads: SquadRepository,
        dictionary: DictionaryRepository,
        ratings: Ratings,
        files: Files,
        audit: Audit,
        notifications: Notifications,
        settings: Settings,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._squads, self._dictionary, self._ratings = uow, squads, dictionary, ratings
        self._files, self._audit, self._notifications, self._settings = files, audit, notifications, settings

    def title(self, discipline: DictionaryColumns, group: DictionaryColumns) -> str:
        """Формирует название сборной по региону, дисциплине и группе."""
        return f"{self._settings.squad_region} · {discipline.name} · {group.name}"

    @staticmethod
    def ordered(lines: Sequence[Line], scores: dict[UUID, list[Score]]) -> list[Line]:
        """Сортирует строки рейтинга для отбора в сборную: по баллам, затем по недавней победе и среднему месту."""
        def key(line: Line) -> tuple[Any, ...]:
            """Строит ключ сортировки для отбора в сборную."""
            own = scores.get(line.user.id, [])
            wins = [score.ends_on for score in own if score.place == 1]
            places = [score.place for score in own if score.place is not None]
            latest = max(wins).toordinal() if wins else 0
            average = sum(places) / len(places) if places else float("inf")
            user = line.user
            return (-line.points, -latest, average, user.last_name, user.first_name, user.middle_name or "")

        return sorted(lines, key=key)

    async def public(self, discipline_id: int | None, kind: GroupKind | None, group_id: int | None) -> Sequence[SquadModel]:
        """Возвращает сборные по фильтру дисциплины и группы."""
        age = group_id if kind == "age" else None
        academic = group_id if kind == "academic" else None
        return await self._squads.list(discipline_id, age, academic, kind)

    async def of_member(self, user_id: UUID) -> list[tuple[SquadModel, SquadMemberModel]]:
        """Возвращает сборные, где пользователь состоит участником, с его записью о членстве."""
        return [
            (squad, member)
            for squad in await self._squads.of_user(user_id)
            for member in squad.members
            if member.user_id == user_id
        ]

    async def draft(
        self,
        discipline_id: int,
        kind: GroupKind,
        group_id: int,
        main_size: int,
        reserve_size: int,
        min_rank_id: int | None = None,
        exclude_ids: Sequence[UUID] = (),
    ) -> Draft:
        """Строит черновик состава по рейтингу; исключённых федерацией вручную заменяют следующие по рейтингу."""
        discipline, group = await self._target(discipline_id, kind, group_id)
        board, scores = await self._ratings.standings(discipline.id, kind, group.id, None, min_rank_id)
        ordered = self.ordered(board.lines, scores)
        excluded = [line for line in ordered if line.user.id in set(exclude_ids)]
        chosen = [line for line in ordered if line.user.id not in set(exclude_ids)]
        picks = [Pick(line, index >= main_size) for index, line in enumerate(chosen[: main_size + reserve_size])]
        current = await self._squads.find(
            discipline.id, group.id if kind == "age" else None, group.id if kind == "academic" else None
        )
        return Draft(discipline, kind, group, main_size, reserve_size, len(chosen), picks, current, excluded)

    async def rank_name(self, rank_id: int | None) -> str | None:
        """Название разряда для текста приказа или None, если фильтра нет."""
        if rank_id is None:
            return None
        item = await self._dictionary.get(DictionaryRankTypeModel, rank_id)
        return item.name if item else None

    async def order_draft(self, draft: Draft, number: str | None, order_date: date | None, min_rank: str | None) -> bytes:
        """Формирует PDF «Список сборной и проект приказа» по черновику состава."""
        today = self._ratings.today()
        rules = await self._ratings.rules()

        def row(line: Line) -> dict[str, Any]:
            """Строка таблицы приказа: ФИО, дата рождения, муниципалитет, баллы."""
            user = line.user
            return {
                "name": full_name(user), "birth": user.birth_date.strftime("%d.%m.%Y"),
                "municipality": user.municipality.name if user.municipality else "—", "points": line.points,
            }

        html = ORDER_TEMPLATES.get_template("order_draft.html").render(
            number=number, order_date=order_date.strftime("%d.%m.%Y") if order_date else None,
            discipline=draft.discipline.name, group=draft.group.name, min_rank=min_rank,
            since=self._ratings.since(today, rules.season).strftime("%d.%m.%Y"), until=today.strftime("%d.%m.%Y"),
            main=[row(pick.line) for pick in draft.picks if not pick.is_reserve],
            reserve=[row(pick.line) for pick in draft.picks if pick.is_reserve],
            excluded=[row(line) for line in draft.excluded],
        )
        from weasyprint import HTML

        return HTML(string=html, base_url=str(ASSETS) + "/").write_pdf() or b""

    async def approve(self, actor_id: UUID, form: SquadForm, ip: str | None) -> SquadModel:
        """Утверждает состав сборной приказом, заменяя предыдущую утверждённую сборную по этой группе, если была."""
        draft = await self.draft(form.discipline_id, form.group_kind, form.group_id, form.main_size, form.reserve_size, form.min_rank_id, form.exclude_ids)
        errors: dict[str, list[str]] = {}
        number = form.order_number.strip()
        if not number:
            errors["order_number"] = ["Укажите номер приказа"]
        if form.order_date > self._ratings.today():
            errors["order_date"] = ["Дата приказа не может быть позже сегодняшней"]
        files, problem = await self._files.usable([form.order_file_id], actor_id, False, frozenset({PDF}))
        if problem:
            errors["order_file_id"] = ["Приказ загружается в PDF" if problem == "type" else problem]
        elif (draft.current and draft.current.order_file_id == form.order_file_id) or (
            await self._squads.uses_file(form.order_file_id)
        ):
            errors["order_file_id"] = ["Загрузите файл нового приказа"]
        if errors:
            raise ValidationFailed(fields=errors)
        if not draft.picks:
            raise NoCandidates()

        title = self.title(draft.discipline, draft.group)
        erased: list[tuple[bool, str]] = []
        previous = draft.current
        replaced: dict[str, Any] | None = None
        if previous is not None:
            replaced = {"order_number": previous.order_number, "order_date": previous.order_date.isoformat()}
            old_file = previous.order_file
            await self._squads.remove(previous)
            erased.append(await self._files.forget(old_file))

        squad = await self._squads.add(
            SquadModel(
                discipline_id=draft.discipline.id,
                age_group_id=draft.group.id if draft.kind == "age" else None,
                academic_group_id=draft.group.id if draft.kind == "academic" else None,
                main_size=form.main_size,
                reserve_size=form.reserve_size,
                order_number=number,
                order_date=form.order_date,
                order_file_id=files[0].id,
                approved_by=actor_id,
                members=[
                    SquadMemberModel(
                        user_id=pick.line.user.id, position=index + 1, is_reserve=pick.is_reserve, points=pick.line.points
                    )
                    for index, pick in enumerate(draft.picks)
                ],
            )
        )
        await self._files.set_public(files, True)
        payload: dict[str, Any] = {
            "id": squad.id,
            "title": f"Сборная {title}",
            "order_number": number,
            "order_date": form.order_date.isoformat(),
            "members": [
                {"user_id": str(pick.line.user.id), "name": full_name(pick.line.user), "reserve": pick.is_reserve}
                for pick in draft.picks
            ],
            "excluded": [{"user_id": str(line.user.id), "name": full_name(line.user)} for line in draft.excluded],
        }
        if replaced is not None:
            payload["previous"] = replaced
        action = AuditAction.SQUAD_REPLACE if replaced is not None else AuditAction.SQUAD_APPROVE
        await self._audit.write(action, actor_id, "squad", payload=payload, ip=ip)
        await self._notifications.squad_included(
            [(pick.line.user.id, pick.is_reserve) for pick in draft.picks], actor_id, title, self.link(squad)
        )
        await self._uow.commit()
        await self._files.erase(erased)
        return squad

    async def dissolve(self, actor_id: UUID, squad_id: int, ip: str | None) -> None:
        """Расформировывает сборную и удаляет файл приказа о её утверждении."""
        squad = await self._squads.get(squad_id)
        if squad is None:
            raise NotFound("Сборная не найдена")
        payload = {
            "id": squad.id,
            "title": f"Сборная {self.title(squad.discipline, squad.group)}",
            "order_number": squad.order_number,
            "order_date": squad.order_date.isoformat(),
        }
        order_file = squad.order_file
        await self._squads.remove(squad)
        stored = await self._files.forget(order_file)
        await self._audit.write(AuditAction.SQUAD_DISSOLVE, actor_id, "squad", payload=payload, ip=ip)
        await self._uow.commit()
        await self._files.erase([stored])

    async def order_url(self, squad: SquadModel) -> str:
        """Возвращает ссылку на файл приказа об утверждении сборной."""
        return await self._files.url(squad.order_file)

    @staticmethod
    def link(squad: SquadModel) -> str:
        """Строит ссылку на страницу сборных с открытой сборной группы."""
        kind = "&kind=academic" if squad.group_kind == "academic" else ""
        group = squad.age_group_id or squad.academic_group_id
        return f"/squads?discipline_id={squad.discipline_id}{kind}&group_id={group}"

    async def _target(
        self, discipline_id: int, kind: GroupKind, group_id: int
    ) -> tuple[DictionaryDisciplineModel, DictionaryColumns]:
        """Проверяет и возвращает активные дисциплину и возрастную/академическую группу по их id."""
        errors: dict[str, list[str]] = {}
        discipline = await self._dictionary.get(DictionaryDisciplineModel, discipline_id)
        if discipline is None or discipline.is_archived:
            errors["discipline_id"] = ["Выберите дисциплину"]
        model = DictionaryAgeGroupModel if kind == "age" else DictionaryAcademicGroupModel
        group = await self._dictionary.get(model, group_id)
        if group is None or group.is_archived:
            errors["group_id"] = ["Выберите группу"]
        if errors or discipline is None or group is None:
            raise ValidationFailed(fields=errors)
        return discipline, group
