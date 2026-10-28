from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, Response

from analytics.dependencies import AnalyticsQuery, AnalyticsService
from analytics.domain import workbook
from analytics.domain.analytics import BLOCKS, Block
from auth.dependencies import CurrentUser, require_role
from infrastructure.enums import Role

router = APIRouter(prefix="/admin/analytics", tags=["Аналитика"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _file(content: bytes, name: str) -> Response:
    """Оборачивает байты xlsx в ответ с заголовком вложенного файла."""
    return Response(
        content,
        media_type=XLSX,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
    )


@router.get(".xlsx", summary="Вся аналитика книгой: лист «Параметры» и по листу на блок")
async def analytics_workbook(user: Federation, analytics: AnalyticsService, query: AnalyticsQuery) -> Response:
    """Отдаёт книгу xlsx со всеми блоками аналитики, по листу на блок."""
    results = [await analytics.build(block, query) for block in BLOCKS]
    content = workbook.build(results, await analytics.parameters(query), with_parameters_sheet=True)
    return _file(content, workbook.filename(query))


@router.get("/{block}.xlsx", summary="Один блок аналитики листом xlsx")
async def analytics_block_xlsx(
    block: Block, user: Federation, analytics: AnalyticsService, query: AnalyticsQuery
) -> Response:
    """Отдаёт один блок аналитики xlsx-файлом."""
    result = await analytics.build(block, query)
    content = workbook.build([result], await analytics.parameters(query), with_parameters_sheet=False)
    return _file(content, workbook.filename(query, block))


@router.get("/{block}", summary="Блок аналитики: показатели за период и сравнение с прошлым")
async def analytics_block(
    block: Block, user: Federation, analytics: AnalyticsService, query: AnalyticsQuery
) -> dict[str, Any]:
    """Отдаёт один блок аналитики в JSON с данными за период и прошлый период."""
    result = await analytics.build(block, query)
    previous = query.period.previous()
    return {
        "block": block,
        "title": workbook.TITLES[block],
        "period": {"from": query.period.start, "to": query.period.end},
        "previous": {"from": previous.start, "to": previous.end},
        **result.data,
    }
