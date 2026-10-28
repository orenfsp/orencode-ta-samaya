from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query, Response, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from infrastructure.enums import Role
from training.dependencies import StaffDep as Staff, JournalDep
from training.domain.journal import SessionChange
from training.features.schemas import AttendanceOut, GroupOut, JournalOut, SessionIn, SessionOut

router = APIRouter(prefix="/training", tags=["Журнал занятий"])
SessionId = Annotated[UUID, Path()]


def _change(body: SessionIn) -> SessionChange:
    """Переводит тело запроса в изменение занятия."""
    return SessionChange(
        held_on=body.held_on, topic=body.topic, format=body.format, proof_url=body.proof_url,
        proof_file_id=body.proof_file_id, note=body.note,
        attendance={mark.athlete_id: mark.present for mark in body.attendance},
    )


@router.get("/groups/{group_id}/sessions", summary="Журнал занятий группы")
async def sessions(
    group_id: Annotated[int, Path()],
    user: Staff,
    journal: JournalDep,
    since: Annotated[date | None, Query(alias="from")] = None,
    until: Annotated[date | None, Query(alias="to")] = None,
) -> JournalOut:
    """Возвращает занятия группы за период, новые первыми."""
    group, items = await journal.sessions(user.id, Role.FEDERATION in user.roles, group_id, since, until)
    return JournalOut(group=GroupOut.of(group), sessions=[SessionOut.of(item) for item in items])


@router.post("/groups/{group_id}/sessions", status_code=status.HTTP_201_CREATED, summary="Записать занятие")
async def create(
    group_id: Annotated[int, Path()], body: Annotated[SessionIn, Body()], user: Staff, ip: ClientIp, journal: JournalDep
) -> SessionOut:
    """Записывает занятие с форматом, подтверждением и отметками посещения."""
    return SessionOut.of(await journal.create(user.id, Role.FEDERATION in user.roles, group_id, _change(body), ip))


@router.put("/sessions/{session_id}", summary="Изменить занятие")
async def update(
    session_id: SessionId, body: Annotated[SessionIn, Body()], user: Staff, ip: ClientIp, journal: JournalDep
) -> SessionOut:
    """Правит занятие и заменяет отметки посещения."""
    return SessionOut.of(await journal.update(user.id, Role.FEDERATION in user.roles, session_id, _change(body), ip))


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить занятие")
async def remove(session_id: SessionId, user: Staff, ip: ClientIp, journal: JournalDep) -> Response:
    """Удаляет занятие из журнала."""
    await journal.remove(user.id, Role.FEDERATION in user.roles, session_id, ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/athletes/{athlete_id}/attendance", summary="Посещаемость спортсмена")
async def attendance(
    athlete_id: Annotated[UUID, Path()],
    user: CurrentUserDep,
    journal: JournalDep,
    days: Annotated[int, Query(ge=7, le=730)] = 90,
) -> AttendanceOut:
    """Занятия групп спортсмена за период и сколько он посетил: ему, тренеру и федерации."""
    report = await journal.attendance(user.id, Role.FEDERATION in user.roles, athlete_id, days)
    return AttendanceOut(
        total=report.total, attended=report.attended, sessions=[SessionOut.of(item) for item in report.sessions],
        groups=[GroupOut.of(group) for group in report.groups.values()],
    )
