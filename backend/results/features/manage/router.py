from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Response

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import Role
from infrastructure.account.user import UserModel
from results.dependencies import ResultsDep
from results.domain.results import Results
from results.features.manage.schemas import AthleteOut, EntryOut, ResultsFormOut, ResultsIn

ContestId = Annotated[int, Path()]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _athlete(user: UserModel) -> AthleteOut:
    """Собирает краткую карточку спортсмена с id и полным именем."""
    return AthleteOut(id=user.id, full_name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part))


async def _form(results: Results, user_id: UUID, federation: bool, contest_id: int) -> ResultsFormOut:
    """Собирает форму внесения мест: соревнование, заявки-участники и уже проставленные места."""
    contest, entries, places = await results.form(user_id, federation, contest_id)
    return ResultsFormOut(
        contest_id=contest.id,
        status=contest.status,
        participation_type=contest.participation_type,
        editable=contest.status in Results.EDITABLE,
        items=[
            EntryOut(
                application_id=entry.id,
                team_name=entry.team_name,
                athletes=[_athlete(member.user) for member in entry.members if member.is_active],
                entered=entry.id in places,
                place=places.get(entry.id),
            )
            for entry in entries
        ],
    )


def build(prefix: str, role: Role, tag: str) -> APIRouter:
    """Собирает роутер управления результатами для указанной роли (организатор или федерация)."""
    router = APIRouter(prefix=prefix, tags=[tag])
    manager = require_role(role)
    federation = role == Role.FEDERATION

    @router.get("/contests/{contest_id}/results", summary="Места: форма")
    async def form(contest_id: ContestId, user: Annotated[CurrentUser, Depends(manager)], results: ResultsDep) -> ResultsFormOut:
        """Возвращает форму внесения мест по соревнованию."""
        return await _form(results, user.id, federation, contest_id)

    @router.put("/contests/{contest_id}/results", summary="Внести места")
    async def save(
        contest_id: ContestId,
        body: Annotated[ResultsIn, Body()],
        user: Annotated[CurrentUser, Depends(manager)],
        ip: ClientIp,
        results: ResultsDep,
    ) -> ResultsFormOut:
        """Сохраняет места участников и возвращает обновлённую форму."""
        await results.save(user.id, federation, contest_id, [(item.application_id, item.place) for item in body.items], ip)
        return await _form(results, user.id, federation, contest_id)

    @router.get("/contests/{contest_id}/results/protocol.xlsx", summary="Протокол xlsx", response_class=Response)
    async def protocol(contest_id: ContestId, user: Annotated[CurrentUser, Depends(manager)], results: ResultsDep) -> Response:
        """Отдаёт xlsx-протокол соревнования файлом."""
        filename, content = await results.protocol(user.id, federation, contest_id)
        return Response(
            content,
            media_type=XLSX,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
        )

    return router


organizer_router = build("/organizer", Role.ORGANIZER, "Места: организатор")
admin_router = build("/admin", Role.FEDERATION, "Места: федерация")
