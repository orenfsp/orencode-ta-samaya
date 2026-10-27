from typing import Annotated

from fastapi import APIRouter, Path

from applications.dependencies import ApplicationsDep
from applications.features.public.schemas import EntryOut, ParticipantList, ParticipantOut

router = APIRouter(tags=["Заявки: публично"])


@router.get("/contests/{contest_id}/participants", summary="Участники соревнования")
async def participants(contest_id: Annotated[int, Path()], applications: ApplicationsDep) -> ParticipantList:
    items = await applications.participants(contest_id)
    entries = [
        EntryOut(
            team_name=item.team_name,
            members=[ParticipantOut.model_validate(member.user) for member in item.members if member.is_active],
        )
        for item in items
    ]
    return ParticipantList(items=entries, total_people=sum(len(entry.members) for entry in entries))
