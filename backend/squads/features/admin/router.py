from datetime import date
from typing import Annotated, Literal
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query, Response, status

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.base import DictionaryColumns
from infrastructure.enums import Role
from people.domain.people import full_name
from squads.dependencies import SquadsDep
from squads.domain.squads import Pick, SquadForm
from squads.features.admin.schemas import ApprovedOut, CandidateOut, CurrentOut, DraftOut, RefOut, SquadIn

router = APIRouter(prefix="/admin/squads", tags=["Сборные: федерация"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


def _ref(item: DictionaryColumns) -> RefOut:
    """Превращает запись справочника в краткую ссылочную схему."""
    return RefOut(id=item.id, name=item.name)


def _candidate(index: int, pick: Pick) -> CandidateOut:
    """Превращает кандидата в сборную в схему ответа с его позицией."""
    user = pick.line.user
    return CandidateOut(
        position=index + 1,
        athlete_id=user.id,
        name=full_name(user),
        municipality=_ref(user.municipality) if user.municipality else None,
        points=pick.line.points,
    )


@router.get("/candidates", summary="Кто войдёт в сборную, если утвердить сейчас")
async def candidates(
    _: Federation,
    squads: SquadsDep,
    discipline_id: Annotated[int, Query(ge=1)],
    group_kind: Annotated[Literal["age", "academic"], Query()],
    group_id: Annotated[int, Query(ge=1)],
    main_size: Annotated[int, Query(ge=1, le=100)],
    reserve_size: Annotated[int, Query(ge=0, le=100)] = 0,
    min_rank_id: Annotated[int | None, Query(ge=1)] = None,
    exclude_ids: Annotated[list[UUID] | None, Query(max_length=100)] = None,
) -> DraftOut:
    """Показывает, кто войдёт в основной состав и резерв сборной; исключённых вручную заменяют следующие по рейтингу."""
    draft = await squads.draft(discipline_id, group_kind, group_id, main_size, reserve_size, min_rank_id, exclude_ids or ())
    current = draft.current
    return DraftOut(
        title=f"Сборная {squads.title(draft.discipline, draft.group)}",
        discipline=_ref(draft.discipline),
        group_kind=group_kind,
        group=_ref(draft.group),
        main_size=main_size,
        reserve_size=reserve_size,
        available=draft.available,
        main=[_candidate(index, pick) for index, pick in enumerate(draft.picks) if not pick.is_reserve],
        reserve=[_candidate(index, pick) for index, pick in enumerate(draft.picks) if pick.is_reserve],
        excluded=[_candidate(index, Pick(line, False)) for index, line in enumerate(draft.excluded)],
        current=CurrentOut(
            id=current.id,
            order_number=current.order_number,
            order_date=current.order_date,
            main=sum(not item.is_reserve for item in current.members),
            reserve=sum(item.is_reserve for item in current.members),
        )
        if current
        else None,
    )


@router.get("/order-draft.pdf", summary="Список сборной и проект приказа, PDF", response_class=Response)
async def order_draft(
    _: Federation,
    squads: SquadsDep,
    discipline_id: Annotated[int, Query(ge=1)],
    group_kind: Annotated[Literal["age", "academic"], Query()],
    group_id: Annotated[int, Query(ge=1)],
    main_size: Annotated[int, Query(ge=1, le=100)],
    reserve_size: Annotated[int, Query(ge=0, le=100)] = 0,
    min_rank_id: Annotated[int | None, Query(ge=1)] = None,
    exclude_ids: Annotated[list[UUID] | None, Query(max_length=100)] = None,
    order_number: Annotated[str | None, Query(max_length=100)] = None,
    order_date: Annotated[date | None, Query()] = None,
) -> Response:
    """Формирует по текущему черновику состава PDF со списком сборной и проектом приказа."""
    draft = await squads.draft(discipline_id, group_kind, group_id, main_size, reserve_size, min_rank_id, exclude_ids or ())
    rank = await squads.rank_name(min_rank_id)
    content = await squads.order_draft(draft, order_number, order_date, rank)
    name = quote(f"Проект приказа — {squads.title(draft.discipline, draft.group)}.pdf")
    return Response(content, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename*=UTF-8''{name}"})


@router.post("", status_code=status.HTTP_201_CREATED, summary="Утвердить сборную по приказу (заменяет действующую)")
async def approve(body: Annotated[SquadIn, Body()], user: Federation, ip: ClientIp, squads: SquadsDep) -> ApprovedOut:
    """Утверждает состав сборной приказом, заменяя действующую сборную этой группы."""
    squad = await squads.approve(
        user.id,
        SquadForm(
            discipline_id=body.discipline_id,
            group_kind=body.group_kind,
            group_id=body.group_id,
            main_size=body.main_size,
            reserve_size=body.reserve_size,
            order_number=body.order_number,
            order_date=body.order_date,
            order_file_id=body.order_file_id,
            min_rank_id=body.min_rank_id,
            exclude_ids=tuple(body.exclude_ids),
        ),
        ip,
    )
    return ApprovedOut(
        id=squad.id,
        title=f"Сборная {squads.title(squad.discipline, squad.group)}",
        link=squads.link(squad),
        main=sum(not item.is_reserve for item in squad.members),
        reserve=sum(item.is_reserve for item in squad.members),
    )


@router.delete("/{squad_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Расформировать сборную")
async def dissolve(squad_id: Annotated[int, Path(ge=1)], user: Federation, ip: ClientIp, squads: SquadsDep) -> Response:
    """Расформировывает сборную."""
    await squads.dissolve(user.id, squad_id, ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
