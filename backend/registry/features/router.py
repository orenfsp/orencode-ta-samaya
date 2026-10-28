from dataclasses import asdict
from datetime import date
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel

from auth.dependencies import CurrentUser, require_role
from infrastructure.enums import TRAINING_STAGE_TITLES, Role, TrainingStage
from registry.dependencies import RegistryDep
from core.xlsx import Column
from registry.domain import workbook
from registry.domain.registry import AthleteFilter, AthleteRow, CategoryState, CoachRow, Cut, JudgeRow, full_name

router = APIRouter(prefix="/admin/registry", tags=["Реестр"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]
Text = Annotated[str | None, Query(max_length=100)]
Id = Annotated[int | None, Query(ge=1)]


class Ref(BaseModel):
    id: int
    name: str


class AthleteOut(BaseModel):
    id: UUID
    name: str
    birth_date: date
    age: int
    age_group: str | None
    municipality: str | None
    organization: Ref | None
    no_organization: bool
    disciplines: list[str]
    start_year: int | None
    training_stage: str | None
    rank: str | None
    rank_valid_until: date | None
    coaches: list[str]


class CoachOut(BaseModel):
    id: UUID
    name: str
    municipality: str | None
    athletes: int
    disciplines: list[str]


class JudgeOut(BaseModel):
    id: UUID
    name: str
    municipality: str | None
    category: str | None
    valid_until: date | None
    state: CategoryState
    assignments: int


class Page[T](BaseModel):
    items: list[T]
    total: int


class HeadcountLine(BaseModel):
    label: str
    counts: list[int]


class HeadcountOut(BaseModel):
    years: list[int]
    dates: list[date]
    cut: str
    total: list[int]
    in_groups: list[int]
    rows: list[HeadcountLine]
    sources: list[str]


def _athlete(row: AthleteRow) -> AthleteOut:
    """Строит строку реестра спортсменов."""
    profile, user = row.profile, row.user
    return AthleteOut(
        id=user.id,
        name=full_name(user),
        birth_date=user.birth_date,
        age=row.age,
        age_group=row.age_group.name if row.age_group else None,
        municipality=user.municipality.name if user.municipality else None,
        organization=Ref(id=profile.organization.id, name=profile.organization.short_name or profile.organization.name)
        if profile and profile.organization
        else None,
        no_organization=bool(profile and profile.no_organization),
        disciplines=[item.discipline.name for item in row.disciplines],
        start_year=profile.start_year if profile else None,
        training_stage=TRAINING_STAGE_TITLES[profile.training_stage] if profile and profile.training_stage else None,
        rank=row.rank.item_name if row.rank else None,
        rank_valid_until=row.rank.valid_until if row.rank else None,
        coaches=[f"{link.coach.last_name} {link.coach.first_name}" for link in row.coaches],
    )


def _coach(row: CoachRow) -> CoachOut:
    """Строит строку реестра тренеров."""
    user = row.user
    return CoachOut(id=user.id, name=full_name(user), municipality=user.municipality.name if user.municipality else None,
                    athletes=row.athletes, disciplines=row.disciplines)


def _judge(row: JudgeRow) -> JudgeOut:
    """Строит строку реестра судей."""
    user = row.user
    return JudgeOut(
        id=user.id, name=full_name(user), municipality=user.municipality.name if user.municipality else None,
        category=row.category.item_name if row.category else None,
        valid_until=row.category.valid_until if row.category else None, state=row.state, assignments=row.assignments,
    )


def _file(name: str, content: bytes) -> Response:
    """Отдаёт xlsx-файл на скачивание."""
    return Response(content, media_type=XLSX, headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})


def _filter(
    q: Text = None,
    discipline_id: Id = None,
    organization_id: Id = None,
    no_organization: Annotated[bool, Query()] = False,
    municipality_id: Id = None,
    age_group_id: Id = None,
    rank_type_id: Id = None,
    without_rank: Annotated[bool, Query()] = False,
    training_stage: Annotated[TrainingStage | None, Query()] = None,
) -> AthleteFilter:
    """Собирает фильтр реестра спортсменов из параметров запроса."""
    return AthleteFilter(q, discipline_id, organization_id, no_organization, municipality_id, age_group_id,
                         rank_type_id, without_rank, training_stage)


AthleteQuery = Annotated[AthleteFilter, Depends(_filter)]
STATES = {"valid": "Действует", "expiring": "Истекает", "expired": "Истекла", "none": "Нет категории"}


@router.get("/athletes", summary="Реестр спортсменов")
async def athletes(_: Federation, registry: RegistryDep, query: AthleteQuery, limit: Limit = 50, offset: Offset = 0) -> Page[AthleteOut]:
    """Возвращает страницу реестра спортсменов."""
    rows = await registry.athletes(query)
    return Page[AthleteOut](items=[_athlete(row) for row in rows[offset:offset + limit]], total=len(rows))


@router.get("/athletes.xlsx", summary="Реестр спортсменов, xlsx", response_class=Response)
async def athletes_xlsx(_: Federation, registry: RegistryDep, query: AthleteQuery) -> Response:
    """Выгружает реестр спортсменов в xlsx."""
    source = await registry.athletes(query)
    rows = [_athlete(row) for row in source]
    columns = (
        Column("№", "center", 6), Column("ФИО", width=34), Column("Дата рождения", "center", 13), Column("Возраст", "int", 9),
        Column("Возрастная группа", width=16), Column("Муниципалитет", width=20), Column("Организация", "wrap", 30),
        Column("Дисциплины", "wrap", 34), Column("Год начала", "center", 10), Column("Этап подготовки", width=20),
        Column("Разряд", "wrap", 26), Column("Разряд до", "center", 12), Column("Тренеры", "wrap", 30), Column("Почта", width=32), Column("Codeforces", width=24),
    )
    return _file("registry-athletes.xlsx", workbook.table("Спортсмены", columns, [
        [index, row.name, row.birth_date, row.age, row.age_group or "—", row.municipality or "—",
         row.organization.name if row.organization else ("Без организации" if row.no_organization else "—"),
         ", ".join(row.disciplines) or "—", row.start_year or "—", row.training_stage or "—", row.rank or "—",
         row.rank_valid_until or "—", ", ".join(row.coaches) or "—", source[index - 1].user.email, source[index - 1].user.codeforces_handle or "—"]
        for index, row in enumerate(rows, start=1)
    ], filters=workbook.filter_facts(asdict(query))))


@router.get("/coaches", summary="Реестр тренеров")
async def coaches(
    _: Federation, registry: RegistryDep, q: Text = None, municipality_id: Id = None, discipline_id: Id = None,
    limit: Limit = 50, offset: Offset = 0,
) -> Page[CoachOut]:
    """Возвращает страницу реестра тренеров."""
    rows = await registry.coaches(q, municipality_id, discipline_id)
    return Page[CoachOut](items=[_coach(row) for row in rows[offset:offset + limit]], total=len(rows))


@router.get("/coaches.xlsx", summary="Реестр тренеров, xlsx", response_class=Response)
async def coaches_xlsx(
    _: Federation, registry: RegistryDep, q: Text = None, municipality_id: Id = None, discipline_id: Id = None
) -> Response:
    """Выгружает реестр тренеров в xlsx."""
    source = await registry.coaches(q, municipality_id, discipline_id)
    rows = [_coach(row) for row in source]
    columns = (Column("№", "center", 6), Column("ФИО", width=34), Column("Муниципалитет", width=22), Column("Спортсменов", "int", 12), Column("Дисциплины", "wrap", 50), Column("Дата рождения", "date", 13), Column("Почта", width=32), Column("Codeforces", width=24))
    return _file("registry-coaches.xlsx", workbook.table("Тренеры", columns, [
        [index, row.name, row.municipality or "—", row.athletes, ", ".join(row.disciplines) or "—", source[index - 1].user.birth_date, source[index - 1].user.email, source[index - 1].user.codeforces_handle or "—"] for index, row in enumerate(rows, start=1)
    ], filters=workbook.filter_facts({"q": q, "municipality_id": municipality_id, "discipline_id": discipline_id})))


@router.get("/judges", summary="Реестр судей")
async def judges(
    _: Federation, registry: RegistryDep, q: Text = None, municipality_id: Id = None,
    state: Annotated[CategoryState | None, Query()] = None, limit: Limit = 50, offset: Offset = 0,
) -> Page[JudgeOut]:
    """Возвращает страницу реестра судей."""
    rows = await registry.judges(q, municipality_id, state)
    return Page[JudgeOut](items=[_judge(row) for row in rows[offset:offset + limit]], total=len(rows))


@router.get("/judges.xlsx", summary="Реестр судей, xlsx", response_class=Response)
async def judges_xlsx(
    _: Federation, registry: RegistryDep, q: Text = None, municipality_id: Id = None,
    state: Annotated[CategoryState | None, Query()] = None,
) -> Response:
    """Выгружает реестр судей в xlsx."""
    source = await registry.judges(q, municipality_id, state)
    rows = [_judge(row) for row in source]
    columns = (
        Column("№", "center", 6), Column("ФИО", width=34), Column("Муниципалитет", width=22), Column("Категория", "wrap", 34),
        Column("Действует до", "center", 13), Column("Статус", width=16), Column("Назначений за год", "int", 12), Column("Дата рождения", "date", 13), Column("Почта", width=32), Column("Codeforces", width=24),
    )
    return _file("registry-judges.xlsx", workbook.table("Судьи", columns, [
        [index, row.name, row.municipality or "—", row.category or "—", row.valid_until or "—", STATES[row.state], row.assignments, source[index - 1].user.birth_date, source[index - 1].user.email, source[index - 1].user.codeforces_handle or "—"]
        for index, row in enumerate(rows, start=1)
    ], filters=workbook.filter_facts({"q": q, "municipality_id": municipality_id, "state": STATES.get(state) if state else None})))


@router.get("/headcount", summary="Численность занимающихся по годам")
async def headcount(
    _: Federation, registry: RegistryDep, cut: Annotated[Cut, Query()] = "total",
    since: Annotated[int | None, Query(alias="from")] = None, until: Annotated[int | None, Query(alias="to")] = None,
) -> HeadcountOut:
    """Возвращает численность занимающихся по годам в разрезе."""
    report = await registry.headcount(since, until, cut)
    return HeadcountOut(years=report.years, dates=report.dates, cut=report.cut, total=report.total,
                        in_groups=report.in_groups, sources=list(report.sources),
                        rows=[HeadcountLine(label=row.label, counts=row.counts) for row in report.rows])


@router.get("/headcount.xlsx", summary="Отчёт о численности, xlsx: все разрезы", response_class=Response)
async def headcount_xlsx(
    _: Federation, registry: RegistryDep,
    since: Annotated[int | None, Query(alias="from")] = None, until: Annotated[int | None, Query(alias="to")] = None,
) -> Response:
    """Выгружает отчёт о численности занимающихся во всех разрезах."""
    cuts: list[Cut] = ["total", "discipline", "organization", "stage", "age_group", "municipality"]
    reports = [await registry.headcount(since, until, cut) for cut in cuts]
    return _file(f"headcount-{reports[0].years[0]}-{reports[0].years[-1]}.xlsx", workbook.headcount(reports))
