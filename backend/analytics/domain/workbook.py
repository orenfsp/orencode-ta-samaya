from typing import Any

from analytics.domain.analytics import TITLES, Query, Result
from core import xlsx
from core.xlsx import Column


def filename(query: Query, block: str | None = None) -> str:
    """Формирует имя xlsx-файла по периоду запроса и, если указан, блоку."""
    period = query.period
    name = f"analytics-{block}" if block else "analytics"
    return f"{name}-{period.start:%Y-%m-%d}-{period.end:%Y-%m-%d}.xlsx"


def build(results: list[Result], parameters: list[list[Any]], with_parameters_sheet: bool) -> bytes:
    """Книга аналитики: лист параметров (по желанию) и по листу на блок; у каждой таблицы — числа числами, доли процентами."""
    book = xlsx.book()
    facts = [(str(label), value) for label, value in parameters]
    if with_parameters_sheet:
        overview = xlsx.sheet(book, "Параметры")
        row = xlsx.header(overview, "Аналитика ФСП Оренбургской области", facts)
        xlsx.table(
            overview,
            row,
            [Column("Лист", width=34), Column("Что внутри", "wrap", 70)],
            [[TITLES[result.block], ", ".join(table.title for table in result.tables)] for result in results],
            freeze=False,
        )
    for result in results:
        sheet = xlsx.sheet(book, TITLES[result.block])
        row = xlsx.header(sheet, TITLES[result.block], facts)
        for index, table in enumerate(result.tables):
            row = xlsx.caption(sheet, row, table.title)
            numeric = [all(isinstance(line[column], (int, float)) or line[column] is None for line in table.rows) and table.rows for column in range(len(table.headers))]
            columns = [
                Column(header, "percent" if column in table.percent_columns else "int" if numeric[column] and column else "wrap")
                for column, header in enumerate(table.headers)
            ]
            row = xlsx.table(sheet, row, columns, table.rows, freeze=index == 0)
    return xlsx.save(book)
