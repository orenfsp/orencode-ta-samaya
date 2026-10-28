from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Path, Query

from infrastructure.base import DictionaryColumns
from infrastructure.squads.squad import SquadModel
from infrastructure.squads.squad_member import SquadMemberModel
from people.domain.people import full_name
from squads.dependencies import SquadsDep
from squads.domain.squads import Squads
from squads.features.public.schemas import (
    AthleteOut,
    BadgeList,
    BadgeOut,
    MemberOut,
    OrderOut,
    RefOut,
    SquadList,
    SquadOut,
)

router = APIRouter(prefix="/squads", tags=["Сборные"])


def _ref(item: DictionaryColumns) -> RefOut:
    """Превращает запись справочника в краткую ссылочную схему."""
    return RefOut(id=item.id, name=item.name)


def _member(item: SquadMemberModel) -> MemberOut:
    """Превращает участника сборной в схему ответа."""
    user = item.user
    return MemberOut(
        position=item.position,
        athlete=AthleteOut(id=user.id, name=full_name(user)),
        municipality=_ref(user.municipality) if user.municipality else None,
        points=item.points,
    )


async def squad_out(squads: Squads, squad: SquadModel) -> SquadOut:
    """Собирает полную схему ответа по сборной с составом и ссылкой на приказ."""
    kind: Literal["age", "academic"] = "age" if squad.group_kind == "age" else "academic"
    return SquadOut(
        id=squad.id,
        title=f"Сборная {squads.title(squad.discipline, squad.group)}",
        discipline=_ref(squad.discipline),
        group_kind=kind,
        group=_ref(squad.group),
        main_size=squad.main_size,
        reserve_size=squad.reserve_size,
        order=OrderOut(
            number=squad.order_number,
            date=squad.order_date,
            url=await squads.order_url(squad),
            file_name=squad.order_file.original_name,
        ),
        approved_at=squad.approved_at,
        main=[_member(item) for item in squad.members if not item.is_reserve],
        reserve=[_member(item) for item in squad.members if item.is_reserve],
    )


@router.get("", summary="Действующие сборные")
async def squads_list(
    squads: SquadsDep,
    discipline_id: Annotated[int | None, Query(ge=1)] = None,
    group_kind: Annotated[Literal["age", "academic"] | None, Query()] = None,
    group_id: Annotated[int | None, Query(ge=1)] = None,
) -> SquadList:
    """Возвращает действующие сборные по фильтру дисциплины и группы."""
    items = await squads.public(discipline_id, group_kind, group_id if group_kind else None)
    return SquadList(items=[await squad_out(squads, item) for item in items])


@router.get("/members/{user_id}", summary="Сборные человека: метки для его страницы")
async def badges(user_id: Annotated[UUID, Path()], squads: SquadsDep) -> BadgeList:
    """Возвращает метки сборных, в которых состоит пользователь, для его страницы."""
    items: list[BadgeOut] = []
    for squad, _ in await squads.of_member(user_id):
        kind: Literal["age", "academic"] = "age" if squad.group_kind == "age" else "academic"
        items.append(
            BadgeOut(
                squad_id=squad.id,
                title=f"Участник сборной {squads.title(squad.discipline, squad.group)}",
                discipline=_ref(squad.discipline),
                group_kind=kind,
                group=_ref(squad.group),
                link=squads.link(squad),
            )
        )
    return BadgeList(items=items)
