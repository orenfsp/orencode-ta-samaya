from typing import Annotated

from fastapi import APIRouter, Body, Depends

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import RATING_SEASON_TITLES, Role
from ratings.dependencies import RatingsDep
from ratings.domain.ratings import Rules
from ratings.features.admin.schemas import RulesIn, RulesOut

router = APIRouter(prefix="/admin/ratings", tags=["Рейтинг спортсменов: правила федерации"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


@router.put("/settings", summary="Изменить правила подсчёта рейтинга")
async def save_settings(body: Annotated[RulesIn, Body()], user: Federation, ip: ClientIp, ratings: RatingsDep) -> RulesOut:
    """Сохраняет коэффициент стабильности, порог призёров и вид сезона."""
    rules = await ratings.save_rules(user.id, Rules(body.stability_factor, body.podium_place, body.podium_count, body.season), ip)
    return RulesOut(
        stability_factor=float(rules.factor),
        podium_place=rules.podium_place,
        podium_count=rules.podium_count,
        season=rules.season,
        season_title=RATING_SEASON_TITLES[rules.season],
        since=ratings.since(ratings.today(), rules.season),
        formula=rules.formula,
    )
