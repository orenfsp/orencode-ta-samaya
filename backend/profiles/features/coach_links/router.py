from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from infrastructure.enums import Role
from profiles.dependencies import CoachLinksDep
from profiles.domain.coach_links import Action
from profiles.features.schemas import CandidateOut, LinkActionIn, LinkOut, LinkRequestIn, MyLinksOut, PersonOut

router = APIRouter(tags=["Тренер и спортсмены"])
LinkId = Annotated[UUID, Path()]


@router.get("/me/coach-links", summary="Мои связи: как тренер и как спортсмен")
async def mine(user: CurrentUserDep, links: CoachLinksDep) -> MyLinksOut:
    """Возвращает связи текущего пользователя как тренера и как спортсмена."""
    as_coach, as_athlete = await links.mine(user.id)
    return MyLinksOut(as_coach=[LinkOut.of(item) for item in as_coach], as_athlete=[LinkOut.of(item) for item in as_athlete])


@router.get("/coach-links/candidates", summary="Поиск спортсмена для привязки")
async def candidates(
    user: CurrentUserDep, links: CoachLinksDep, q: Annotated[str | None, Query(max_length=100)] = None
) -> list[CandidateOut]:
    """Ищет спортсменов для привязки к тренеру."""
    users, linked = await links.search(user.id, q)
    return [
        CandidateOut(
            athlete=PersonOut.of(item),
            municipality=item.municipality.name if item.municipality else None,
            linked=item.id in linked,
        )
        for item in users
    ]


@router.post("/coach-links", status_code=status.HTTP_201_CREATED, summary="Запросить привязку спортсмена")
async def request(
    body: Annotated[LinkRequestIn, Body()], user: CurrentUserDep, ip: ClientIp, links: CoachLinksDep
) -> LinkOut:
    """Тренер отправляет спортсмену запрос на привязку."""
    item = await links.request(user.id, user.roles, body.athlete_id, body.discipline_id, body.comment, ip)
    return LinkOut.of(item)


@router.get("/coach-links/{link_id}", summary="Связь и её история")
async def get(link_id: LinkId, user: CurrentUserDep, links: CoachLinksDep) -> LinkOut:
    """Возвращает связь с историей."""
    return LinkOut.of(await links.get(user.id, link_id, Role.FEDERATION in user.roles))


@router.post("/coach-links/{link_id}/{action}", summary="Принять, отклонить, приостановить, возобновить, завершить")
async def move(
    link_id: LinkId,
    action: Annotated[Action, Path()],
    user: CurrentUserDep,
    ip: ClientIp,
    links: CoachLinksDep,
    body: Annotated[LinkActionIn | None, Body()] = None,
) -> LinkOut:
    """Меняет статус связи действием одной из сторон."""
    return LinkOut.of(await links.move(user.id, link_id, action, body.comment if body else None, ip))
