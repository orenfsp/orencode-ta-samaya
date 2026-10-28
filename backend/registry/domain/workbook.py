from collections.abc import Sequence
from typing import Any

from core import xlsx
from core.xlsx import Column
from registry.domain.registry import Headcount

CUT_TITLES = {
    "total": "Всего",
    "discipline": "По дисциплинам",
    "organization": "По организациям",
    "stage": "По этапам подготовки",
    "age_group": "По возрастным группам",
    "municipality": "По муниципалитетам",
}


def table(title: str, columns: Sequence[Column], rows: Sequence[Sequence[Any]], filters: Sequence[tuple[str, Any]] = ()) -> bytes:
    """Книга реестра: шапка с числом записей и таблица со стилем платформы."""
    book = xlsx.book()
    sheet = xlsx.sheet(book, title)
    row = xlsx.header(sheet, f"Реестр: {title.lower()}", [("Записей", len(rows)), *filters])
    xlsx.table(sheet, row, columns, rows)
    return xlsx.save(book)


def headcount(reports: Sequence[Headcount]) -> bytes:
    """Отчёт о численности занимающихся: лист на каждый разрез, по годам, с изменением за последний год."""
    book = xlsx.book()
    for report in reports:
        sheet = xlsx.sheet(book, CUT_TITLES[report.cut])
        row = xlsx.header(
            sheet,
            "Численность занимающихся спортивным программированием в Оренбургской области",
            [
                ("Разрез", CUT_TITLES[report.cut]),
                ("Годы", f"{report.years[0]}–{report.years[-1]}"),
                ("Как считается", "на конец года, текущий год — на дату выгрузки"),
                ("Источники", "; ".join(report.sources)),
            ],
        )
        columns = [
            Column("Показатель", "wrap", 48),
            *[Column(str(year), "int", 11) for year in report.years],
            Column("Изменение за год", "int", 14),
            Column("Изменение, %", "percent", 13),
        ]

        def line(label: str, counts: Sequence[int]) -> list[Any]:
            """Строка отчёта: значения по годам, разница и процент к прошлому году."""
            delta = counts[-1] - counts[-2] if len(counts) > 1 else 0
            share = round(delta / counts[-2] * 100, 1) if len(counts) > 1 and counts[-2] else None
            return [label, *counts, delta, share]

        rows = [line("из них в учебно-тренировочных группах", report.in_groups), *[line(item.label, item.counts) for item in report.rows]]
        xlsx.table(sheet, row, columns, rows, empty="", total=line("Всего занимающихся", report.total))
    return xlsx.save(book)


def filter_facts(values: dict[str, Any]) -> list[tuple[str, Any]]:
    """Подписи применённых фильтров реестра для шапки выгрузки."""
    labels = {"q": "Поиск", "discipline_id": "Дисциплина, ID", "organization_id": "Организация, ID", "municipality_id": "Муниципалитет, ID", "age_group_id": "Возрастная группа, ID", "rank_type_id": "Разряд, ID", "no_organization": "Без организации", "without_rank": "Без разряда", "training_stage": "Этап подготовки", "state": "Срок категории"}
    return [(labels[key], "Да" if value is True else value) for key, value in values.items() if value] or [("Фильтры", "Все записи")]
