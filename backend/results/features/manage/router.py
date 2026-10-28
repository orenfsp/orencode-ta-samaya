from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Path, Response, UploadFile

from auth.dependencies import CurrentUser, require_role
from core.config import settings
from core.errors import FileTooLarge
from core.request import ClientIp
from infrastructure.enums import Role
from infrastructure.account.user import UserModel
from results.dependencies import ProtocolImportDep, ResultsDep
from results.domain.results import Results
from results.features.manage.schemas import AthleteOut, EntryOut, ImportOut, ImportRowOut, ResultsFormOut, ResultsIn

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
        reason = f"Импорт протокола: {body.source}" if body.source else None
        await results.save(user.id, federation, contest_id, [(item.application_id, item.place) for item in body.items], ip,
                           reason)
        return await _form(results, user.id, federation, contest_id)

    @router.post("/contests/{contest_id}/results/import", summary="Импорт протокола из xlsx или PDF: предпросмотр")
    async def import_preview(
        contest_id: ContestId,
        file: Annotated[UploadFile, File()],
        user: Annotated[CurrentUser, Depends(manager)],
        importer: ProtocolImportDep,
    ) -> ImportOut:
        """Сопоставляет строки протокола с одобренными заявками; места сохраняются отдельно через PUT results."""
        data = await file.read(settings.file_max_size_mb * 1024 * 1024 + 1)
        if len(data) > settings.file_max_size_mb * 1024 * 1024:
            raise FileTooLarge()
        preview = await importer.preview(user.id, federation, contest_id, file.filename or "protocol", file.content_type, data)
        return ImportOut(
            file_name=preview.file_name,
            matched=sum(1 for row in preview.rows if row.status == "matched"),
            doubtful=sum(1 for row in preview.rows if row.status == "doubtful"),
            unmatched=sum(1 for row in preview.rows if row.status == "unmatched"),
            rows=[ImportRowOut(line=row.line, name=row.name, place=row.place, disqualified=row.disqualified,
                               points=row.points, status=row.status, application_id=row.application_id,
                               candidates=row.candidates, note=row.note) for row in preview.rows],
            entries=[
                EntryOut(application_id=entry.id, team_name=entry.team_name,
                         athletes=[_athlete(member.user) for member in entry.members if member.is_active],
                         entered=False, place=None)
                for entry in preview.entries
            ],
            missing=preview.missing,
        )

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
