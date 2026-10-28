from dataclasses import dataclass
from datetime import date

from infrastructure.enums import CONTEST_STATUS_TITLES, TRAINING_STAGE_TITLES, Role
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.squads.squad import SquadModel
from reports.domain.person_report import PersonReport, full_name

ROLE_TITLES = {
    Role.ATHLETE: "Спортсмен",
    Role.COACH: "Тренер",
    Role.JUDGE: "Судья",
    Role.ORGANIZER: "Организатор",
    Role.FEDERATION: "Сотрудник федерации",
}


@dataclass(frozen=True, slots=True)
class Section:
    key: str
    title: str
    headers: tuple[str, ...]
    rows: list[list[str | int]]
    empty: str


def _day(value: date | None) -> str:
    """Форматирует дату в виде дд.мм.гггг или прочерк, если даты нет."""
    return value.strftime("%d.%m.%Y") if value else "—"


def _dates(starts: date, ends: date) -> str:
    """Форматирует период: одна дата, если начало и конец совпадают, иначе диапазон."""
    return _day(starts) if starts == ends else f"{_day(starts)} – {_day(ends)}"


def _term(item: QualificationModel) -> str:
    """Описывает срок действия разряда или категории: «Бессрочно» или дату окончания."""
    if item.valid_until is None:
        return "Бессрочно"
    return f"до {_day(item.valid_until)}"


def _group(squad: SquadModel) -> str:
    """Возвращает название возрастной или учебной группы сборной, либо прочерк."""
    group = squad.age_group or squad.academic_group
    return group.name if group else "—"


KINDS = {"age": "по возрасту", "academic": "по учёбе"}


def facts(report: PersonReport) -> list[tuple[str, str]]:
    """Собирает строки с основными фактами о человеке для шапки отчёта."""
    user = report.user
    rows = [
        ("Дата рождения", _day(user.birth_date)),
        ("Почта", user.email),
        ("Codeforces", user.codeforces_handle or "—"),
        ("Роли", ", ".join(ROLE_TITLES[role] for role in report.roles) or "—"),
    ]
    if report.profile:
        profile = report.profile
        rows.extend([
            ("Организация", profile.organization.short_name or profile.organization.name if profile.organization else "Без организации" if profile.no_organization else "—"),
            ("Год начала подготовки", str(profile.start_year) if profile.start_year else "—"),
            ("Этап подготовки", TRAINING_STAGE_TITLES[profile.training_stage] if profile.training_stage else "—"),
        ])
    if user.municipality:
        rows.append(("Муниципалитет", user.municipality.name))
    if user.academic_group:
        rows.append(("Группа", user.academic_group.name))
    rows += [
        ("Период", f"{_day(report.since)} – {_day(report.until)}"),
        ("Сформирован", report.created.strftime("%d.%m.%Y %H:%M")),
    ]
    return rows


def sections(report: PersonReport) -> list[Section]:
    """Строит все разделы отчёта по человеку с заголовками и строками таблиц."""
    result = [
        Section(
            "starts",
            "Соревнования",
            ("Даты", "Соревнование", "Дисциплина", "Уровень", "Команда", "Место", "Баллы"),
            [
                [
                    _dates(item.contest.starts_on, item.contest.ends_on),
                    item.contest.title,
                    item.contest.discipline.name,
                    item.contest.contest_level.name,
                    item.team_name or "—",
                    item.place if item.place is not None else ("Дисквалификация" if item.entered else "—"),
                    item.points,
                ]
                for item in report.starts
            ],
            "Выступлений за период нет",
        ),
        Section(
            "rating",
            "Рейтинг",
            ("Дисциплина", "Группа", "Место", "Из", "Баллы", "Соревнований"),
            [
                [
                    item.board.discipline.name,
                    f"{item.board.group.name}, {KINDS[item.board.kind]}",
                    item.line.place,
                    len(item.board.lines),
                    item.line.points,
                    item.line.contests,
                ]
                for item in report.standings
            ],
            "В рейтингах за последние 365 дней не участвует",
        ),
        Section(
            "ranks",
            "Разряды и звания",
            ("Разряд", "Присвоен", "Срок", "Статус"),
            [
                [item.item_name, _day(item.valid_from), _term(item), "Действует" if item.status.value == "approved" else "Заменён"]
                for item in report.ranks
            ],
            "Разрядов нет",
        ),
        Section(
            "documents",
            "Документы",
            ("Номер", "Вид", "Название", "Соревнование", "Выдан"),
            [[item.number, item.kind, item.title, item.contest, item.issued_on] for item in report.documents],
            "Документов за период нет",
        ),
        Section(
            "squads",
            "Сборные",
            ("Дисциплина", "Группа", "Состав", "Позиция", "Приказ"),
            [
                [
                    item.squad.discipline.name,
                    _group(item.squad),
                    "Резерв" if item.is_reserve else "Основной",
                    item.position,
                    f"№ {item.squad.order_number} от {_day(item.squad.order_date)}",
                ]
                for item in report.squads
            ],
            "В сборные не входит",
        ),
    ]
    if Role.ATHLETE not in report.roles:
        result = [item for item in result if item.key != "rating"]
    if report.judged or report.categories:
        result.append(
            Section(
                "judging",
                "Судейство",
                ("Даты", "Соревнование", "Должность", "Статус соревнования"),
                [
                    [
                        _dates(item.contest.starts_on, item.contest.ends_on),
                        item.contest.title,
                        item.position.name,
                        CONTEST_STATUS_TITLES[item.contest.status],
                    ]
                    for item in report.judged
                ],
                "Назначений за период нет",
            )
        )
        result.append(
            Section(
                "categories",
                "Судейская категория",
                ("Категория", "Присвоена", "Срок", "Статус"),
                [
                    [item.item_name, _day(item.valid_from), _term(item), "Действует" if item.status.value == "approved" else "Заменена"]
                    for item in report.categories
                ],
                "Категории нет",
            )
        )
    if report.coached:
        result.append(
            Section(
                "coached",
                "Подопечные",
                ("Даты", "Соревнование", "Спортсмен", "Команда", "Место"),
                [
                    [
                        _dates(item.contest.starts_on, item.contest.ends_on),
                        item.contest.title,
                        full_name(item.athlete),
                        item.team_name or "—",
                        item.place if item.place is not None else "—",
                    ]
                    for item in report.coached
                ],
                "",
            )
        )
        result.append(
            Section(
                "pupils",
                "Рейтинг подопечных",
                ("Спортсмен", "Дисциплина", "Группа", "Место", "Из", "Баллы"),
                [
                    [
                        full_name(item.line.user),
                        item.board.discipline.name,
                        f"{item.board.group.name}, {KINDS[item.board.kind]}",
                        item.line.place,
                        len(item.board.lines),
                        item.line.points,
                    ]
                    for item in report.pupils
                ],
                "Подопечных в рейтингах за последние 365 дней нет",
            )
        )
    return result


def filename(report: PersonReport, extension: str) -> str:
    """Формирует имя файла отчёта с id человека и периодом."""
    return f"report-{str(report.user.id)[:8]}-{report.since:%Y%m%d}-{report.until:%Y%m%d}.{extension}"
