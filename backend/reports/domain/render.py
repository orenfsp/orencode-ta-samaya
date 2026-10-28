from datetime import datetime
from typing import Any
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from core import xlsx as xlsx_kit
from core.xlsx import Column

from reports.domain.layout import facts, sections
from reports.domain.person_report import PersonReport, full_name

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT.parent / "documents" / "assets"
TEMPLATES = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))


def summary(report: PersonReport) -> list[tuple[int, str]]:
    """Считает сводные числа отчёта: соревнования, призовые места, баллы, документы."""
    places = [item.place for item in report.starts if item.place is not None]
    return [
        (len(report.starts), "соревнований"),
        (sum(1 for place in places if place <= 3), "призовых мест"),
        (report.points, "баллов за период"),
        (len(report.documents), "документов"),
    ]


def pdf(report: PersonReport) -> bytes:
    """Рендерит отчёт по человеку в PDF по HTML-шаблону."""
    html = TEMPLATES.get_template("person_report.html").render(
        name=full_name(report.user), facts=facts(report), summary=summary(report), sections=sections(report)
    )
    from weasyprint import HTML

    return HTML(string=html, base_url=str(ASSETS) + "/").write_pdf() or b""


def xlsx(report: PersonReport) -> bytes:
    """Рендерит отчёт по человеку в книгу xlsx: сводный лист и лист на каждый раздел; даты — датами, места и баллы — числами."""
    book = xlsx_kit.book()
    overview = xlsx_kit.sheet(book, "Сводка")
    row = xlsx_kit.header(overview, f"Отчёт по человеку: {full_name(report.user)}", [item for item in facts(report) if item[0] == "Период"])
    xlsx_kit.table(
        overview,
        row,
        [Column("Показатель", width=28), Column("Значение", "int", 14)],
        [[caption, value] for value, caption in summary(report)],
        freeze=True,
    )
    info_row = overview.max_row + 3
    xlsx_kit.table(overview, info_row, [Column("Сведения", width=28), Column("Значение", "wrap", 60)], [(label, report.user.birth_date if label == "Дата рождения" else value) for label, value in facts(report) if label not in ("Сформирован", "Период")], freeze=False)
    for section in sections(report):
        page = xlsx_kit.sheet(book, section.title)
        start = xlsx_kit.header(page, section.title, [("Человек", full_name(report.user))])
        rows: list[list[Any]] = [[_date(value) for value in values] for values in section.rows]
        headers = section.headers
        if section.key == "starts":
            headers = ("Начало", "Окончание", "Соревнование", "Дисциплина", "Уровень", "Формат", "Место проведения", "Команда", "Состав команды", "Место", "Баллы")
            rows = [[item.contest.starts_on, item.contest.ends_on, item.contest.title, item.contest.discipline.name, item.contest.contest_level.name, item.contest.contest_format.name, ", ".join(part for part in (item.contest.municipality.name if item.contest.municipality else None, item.contest.venue) if part), item.team_name or "—", ", ".join(full_name(user) for user in item.members) if item.team_name else "—", item.place if item.place is not None else "Дисквалификация" if item.entered else "—", item.points] for item in report.starts]
        elif section.key in ("ranks", "categories"):
            headers = (section.headers[0], "Присвоен", "Действует до", "Статус")
            qualifications = report.ranks if section.key == "ranks" else report.categories
            rows = [[item.item_name, item.valid_from, item.valid_until, "Действует" if item.status.value == "approved" else "Заменён"] for item in qualifications]
        elif section.key in ("judging", "coached"):
            headers = ("Начало", "Окончание", *section.headers[1:])
            contests = [item.contest for item in report.judged] if section.key == "judging" else [item.contest for item in report.coached]
            rows = [[contest.starts_on, contest.ends_on, *values[1:]] for contest, values in zip(contests, rows)]
        numeric = [bool(rows) and all(isinstance(line[column], int) or line[column] in ("", "—") for line in rows) for column in range(len(headers))]
        columns = [Column(header, "int" if numeric[column] else "wrap") for column, header in enumerate(headers)]
        xlsx_kit.table(page, start, columns, rows, empty=section.empty)
    return xlsx_kit.save(book)


def _date(value: object) -> object:
    """Дата «ДД.ММ.ГГГГ» строкой → дата, чтобы в Excel по ней сортировали и фильтровали."""
    if isinstance(value, str) and len(value) == 10 and value[2] == "." and value[5] == ".":
        try:
            return datetime.strptime(value, "%d.%m.%Y").date()
        except ValueError:
            return value
    return value
