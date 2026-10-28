from typing import Annotated

from fastapi import APIRouter, Body, Depends, Path, status

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import Role
from profiles.domain.organizations import mask_inn
from training.dependencies import ProgramsDep
from training.domain.access import full_name
from training.domain.programs import OrganizationCard
from training.features.schemas import CardOut, CoachIn, CoachOut, GroupOut, PersonOut, ProgramIn, ProgramOut, RefOut, StageOut

router = APIRouter(tags=["Организации спортивной подготовки"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
OrganizationId = Annotated[int, Path()]


def _card(card: OrganizationCard, full: bool) -> CardOut:
    """Строит схему карточки организации; ИНН полностью — только федерации."""
    item = card.organization
    return CardOut(
        id=item.id, name=item.name, short_name=item.short_name,
        organization_type=RefOut(id=item.organization_type.id, name=item.organization_type.name),
        municipality=RefOut(id=item.municipality.id, name=item.municipality.name) if item.municipality else None,
        inn=item.inn if full else mask_inn(item.inn), address=item.address, website=item.website,
        license_number=item.license_number, license_date=item.license_date, is_active=item.is_active,
        programs=[ProgramOut(id=program.id, discipline=RefOut(id=program.discipline.id, name=program.discipline.name),
                             stage=StageOut.of(program.stage), valid_from=program.valid_from) for program in card.programs],
        coaches=[CoachOut(id=coach.id, coach=PersonOut(id=coach.coach.id, name=full_name(coach.coach)),
                          position=coach.position, valid_from=coach.valid_from) for coach in card.coaches],
        groups=[GroupOut.of(group, card.sizes.get(group.id, 0)) for group in card.groups],
        athletes=sum(card.sizes.values()),
    )


@router.get("/organizations/{organization_id}", summary="Карточка организации: программы, тренеры, группы")
async def card(organization_id: OrganizationId, programs: ProgramsDep) -> CardOut:
    """Публичная карточка действующей организации."""
    return _card(await programs.card(organization_id, True), False)


@router.get("/admin/organizations/{organization_id}", summary="Карточка организации для федерации")
async def admin_card(organization_id: OrganizationId, _: Federation, programs: ProgramsDep) -> CardOut:
    """Карточка организации с полным ИНН, включая неактивные."""
    return _card(await programs.card(organization_id, False), True)


@router.post("/admin/organizations/{organization_id}/programs", status_code=status.HTTP_201_CREATED,
             summary="Добавить программу подготовки")
async def add_program(
    organization_id: OrganizationId, body: Annotated[ProgramIn, Body()], user: Federation, ip: ClientIp,
    programs: ProgramsDep,
) -> CardOut:
    """Добавляет программу спортивной подготовки по дисциплине и этапу."""
    return _card(await programs.add_program(user.id, organization_id, body.discipline_id, body.stage, ip), True)


@router.delete("/admin/organizations/{organization_id}/programs/{program_id}", summary="Закрыть программу подготовки")
async def close_program(
    organization_id: OrganizationId, program_id: Annotated[int, Path()], user: Federation, ip: ClientIp,
    programs: ProgramsDep,
) -> CardOut:
    """Закрывает программу сегодняшним днём; история остаётся."""
    return _card(await programs.close_program(user.id, organization_id, program_id, ip), True)


@router.post("/admin/organizations/{organization_id}/coaches", status_code=status.HTTP_201_CREATED,
             summary="Добавить тренера-преподавателя")
async def add_coach(
    organization_id: OrganizationId, body: Annotated[CoachIn, Body()], user: Federation, ip: ClientIp,
    programs: ProgramsDep,
) -> CardOut:
    """Добавляет тренера-преподавателя в организацию."""
    return _card(await programs.add_coach(user.id, organization_id, body.coach_id, body.position, ip), True)


@router.delete("/admin/organizations/{organization_id}/coaches/{record_id}", summary="Завершить работу тренера")
async def close_coach(
    organization_id: OrganizationId, record_id: Annotated[int, Path()], user: Federation, ip: ClientIp,
    programs: ProgramsDep,
) -> CardOut:
    """Завершает работу тренера в организации сегодняшним днём."""
    return _card(await programs.close_coach(user.id, organization_id, record_id, ip), True)
