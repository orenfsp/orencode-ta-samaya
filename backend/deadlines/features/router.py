from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, Path, Query, status
from pydantic import BaseModel, Field, StringConstraints

from auth.dependencies import CurrentUser, CurrentUserDep, require_role
from core.request import ClientIp
from deadlines.dependencies import DeadlinesDep
from deadlines.domain.deadlines import governor_due, today
from infrastructure.services.report_deadline import ReportDeadlineModel
from infrastructure.enums import Role

router = APIRouter(tags=["Сроки"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]


class DeadlineOut(BaseModel):
    kind: Literal["registration", "rank", "category", "antidoping", "governor", "report"]
    title: str
    detail: str
    due: date
    days_left: int
    link: str


class ReportOut(BaseModel):
    id: int
    title: str
    description: str | None
    recipient: str | None
    due_on: date
    done_at: datetime | None
    days_left: int

    @classmethod
    def of(cls, item: ReportDeadlineModel) -> "ReportOut":
        """Строит схему отчётного срока из модели."""
        return cls(id=item.id, title=item.title, description=item.description, recipient=item.recipient,
                   due_on=item.due_on, done_at=item.done_at, days_left=(item.due_on - today()).days)


class ReportIn(BaseModel):
    title: Text = Field(min_length=2)
    due_on: date
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    recipient: Text | None = None
    done: bool | None = None


class GovernorOut(BaseModel):
    due: date
    days_left: int


@router.get("/me/deadlines", summary="Мои сроки на 60 дней вперёд")
async def mine(user: CurrentUserDep, deadlines: DeadlinesDep) -> list[DeadlineOut]:
    """Возвращает сроки текущего пользователя по всем его ролям."""
    return [
        DeadlineOut(kind=item.kind, title=item.title, detail=item.detail, due=item.due, days_left=item.days_left,
                    link=item.link)
        for item in await deadlines.mine(user.id, user.roles)
    ]


@router.get("/admin/report-deadlines", summary="Отчётные сроки федерации")
async def reports(
    _: Federation, deadlines: DeadlinesDep, include_done: Annotated[bool, Query()] = False
) -> list[ReportOut]:
    """Возвращает отчётные сроки федерации."""
    return [ReportOut.of(item) for item in await deadlines.reports(include_done)]


@router.get("/admin/report-deadlines/governor", summary="Срок ходатайств на премии Губернатора")
async def governor(_: Federation) -> GovernorOut:
    """Возвращает срок ходатайств на премии Губернатора и сколько до него дней."""
    due = governor_due(today())
    return GovernorOut(due=due, days_left=(due - today()).days)


@router.post("/admin/report-deadlines", status_code=status.HTTP_201_CREATED, summary="Добавить отчётный срок")
async def create(body: Annotated[ReportIn, Body()], user: Federation, ip: ClientIp, deadlines: DeadlinesDep) -> ReportOut:
    """Создаёт отчётный срок."""
    item = await deadlines.save_report(user.id, None, body.title, body.due_on, body.description, body.recipient, body.done, ip)
    return ReportOut.of(item)


@router.patch("/admin/report-deadlines/{report_id}", summary="Изменить или отметить выполненным")
async def update(
    report_id: Annotated[int, Path()], body: Annotated[ReportIn, Body()], user: Federation, ip: ClientIp,
    deadlines: DeadlinesDep,
) -> ReportOut:
    """Правит отчётный срок."""
    item = await deadlines.save_report(user.id, report_id, body.title, body.due_on, body.description, body.recipient,
                                       body.done, ip)
    return ReportOut.of(item)


@router.delete("/admin/report-deadlines/{report_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить")
async def remove(report_id: Annotated[int, Path()], _: Federation, deadlines: DeadlinesDep) -> None:
    """Удаляет отчётный срок."""
    await deadlines.remove_report(report_id)
