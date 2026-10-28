from typing import Annotated

from fastapi import APIRouter, Path

from infrastructure.enums import VerificationStatus
from infrastructure.account.user import UserModel
from results.dependencies import ResultsDep
from results.features.public.schemas import AthleteOut, PlaceOut, ResultsOut

router = APIRouter(tags=["Места: публично"])


def _athlete(user: UserModel) -> AthleteOut:
    """Собирает краткую карточку спортсмена с id и полным именем."""
    return AthleteOut(id=user.id, full_name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part))


@router.get("/contests/{contest_id}/results", summary="Места соревнования")
async def contest_results(contest_id: Annotated[int, Path()], results: ResultsDep) -> ResultsOut:
    """Возвращает итоговые места соревнования, сгруппированные по заявкам."""
    contest, rows, teams = await results.public(contest_id)
    grouped: dict[int, PlaceOut] = {}
    for row in rows:
        item = grouped.setdefault(
            row.application_id, PlaceOut(place=row.place, points=row.points, team_name=teams.get(row.application_id), athletes=[])
        )
        item.athletes.append(_athlete(row.user))
    return ResultsOut(
        participation_type=contest.participation_type,
        is_verified=contest.verification_status == VerificationStatus.VERIFIED,
        items=list(grouped.values()),
    )
