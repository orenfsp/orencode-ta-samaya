from datetime import date
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Path, Query
from fastapi.responses import Response
from pydantic import BaseModel

from auth.dependencies import CurrentUserDep
from reports.dependencies import PersonReportsDep
from reports.domain import render
from reports.domain.layout import filename

router = APIRouter(tags=["Отчёты"])
UserId = Annotated[UUID, Path()]
Since = Annotated[date | None, Query(alias="from")]
Until = Annotated[date | None, Query(alias="to")]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class AccessOut(BaseModel):
    allowed: bool
    date_from: date
    date_to: date


def _file(name: str, content: bytes, media_type: str) -> Response:
    """Оборачивает содержимое файла в ответ с заголовком на скачивание."""
    disposition = f"attachment; filename*=UTF-8''{quote(name)}"
    return Response(content, media_type=media_type, headers={"Content-Disposition": disposition})


@router.get("/people/{user_id}/report", summary="Можно ли скачать отчёт и период по умолчанию")
async def access(user_id: UserId, user: CurrentUserDep, reports: PersonReportsDep) -> AccessOut:
    """Возвращает, доступен ли отчёт текущему пользователю, и период по умолчанию."""
    start, end = reports.period(None, None)
    return AccessOut(allowed=await reports.can_view(user.id, user.roles, user_id), date_from=start, date_to=end)


@router.get("/people/{user_id}/report.pdf", summary="Отчёт по человеку, PDF", response_class=Response)
async def report_pdf(
    user_id: UserId, user: CurrentUserDep, reports: PersonReportsDep, since: Since = None, until: Until = None
) -> Response:
    """Отдаёт отчёт по человеку в формате PDF."""
    report = await reports.collect(user.id, user.roles, user_id, since, until)
    return _file(filename(report, "pdf"), render.pdf(report), "application/pdf")


@router.get("/people/{user_id}/report.xlsx", summary="Отчёт по человеку, xlsx", response_class=Response)
async def report_xlsx(
    user_id: UserId, user: CurrentUserDep, reports: PersonReportsDep, since: Since = None, until: Until = None
) -> Response:
    """Отдаёт отчёт по человеку в формате xlsx."""
    report = await reports.collect(user.id, user.roles, user_id, since, until)
    return _file(filename(report, "xlsx"), render.xlsx(report), XLSX)
