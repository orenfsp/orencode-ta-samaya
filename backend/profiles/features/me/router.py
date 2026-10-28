from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from profiles.dependencies import SportProfilesDep
from profiles.domain.sport_profiles import ProfileChange, SportProfile
from profiles.features.schemas import (
    AntidopingIn,
    AntidopingOut,
    LinkOut,
    OrganizationPeriodOut,
    RefOut,
    SportProfileIn,
    SportProfileOut,
    StageOut,
)

router = APIRouter(prefix="/me", tags=["Спортивный профиль"])


def _out(item: SportProfile) -> SportProfileOut:
    """Строит схему спортивного профиля."""
    profile, user = item.profile, item.user
    return SportProfileOut(
        municipality=RefOut(id=user.municipality.id, name=user.municipality.name) if user.municipality else None,
        sex=profile.sex if profile else None,
        organization=RefOut(id=profile.organization.id, name=profile.organization.name)
        if profile and profile.organization
        else None,
        no_organization=profile.no_organization if profile else False,
        start_year=profile.start_year if profile else None,
        training_stage=StageOut.of(profile.training_stage) if profile else None,
        disciplines=[RefOut(id=row.discipline.id, name=row.discipline.name) for row in item.disciplines],
        organization_history=[
            OrganizationPeriodOut(
                organization=row.organization.name if row.organization else "Без организации",
                valid_from=row.valid_from,
                valid_to=row.valid_to,
            )
            for row in item.organizations
        ],
        coaches=[LinkOut.of(link) for link in item.coaches],
        antidoping=[
            AntidopingOut(
                id=row.id,
                passed_on=row.passed_on,
                valid_until=row.valid_until,
                certificate_url=row.certificate_url,
                file_url=f"/api/v1/files/{row.file_id}" if row.file_id else None,
            )
            for row in item.antidoping
        ],
    )


@router.get("/sport-profile", summary="Спортивный профиль")
async def get_profile(user: CurrentUserDep, profiles: SportProfilesDep) -> SportProfileOut:
    """Возвращает спортивный профиль текущего пользователя."""
    return _out(await profiles.get(user.id))


@router.put("/sport-profile", summary="Сохранить спортивный профиль")
async def save_profile(
    body: Annotated[SportProfileIn, Body()], user: CurrentUserDep, ip: ClientIp, profiles: SportProfilesDep
) -> SportProfileOut:
    """Сохраняет спортивный профиль текущего пользователя."""
    change = ProfileChange(
        municipality_id=body.municipality_id,
        sex=body.sex,
        organization_id=body.organization_id,
        no_organization=body.no_organization,
        start_year=body.start_year,
        training_stage=body.training_stage,
        discipline_ids=list(dict.fromkeys(body.discipline_ids)),
    )
    return _out(await profiles.update(user.id, change, ip))


@router.post("/antidoping", status_code=status.HTTP_201_CREATED, summary="Отметить антидопинговый курс РУСАДА")
async def add_antidoping(
    body: Annotated[AntidopingIn, Body()], user: CurrentUserDep, ip: ClientIp, profiles: SportProfilesDep
) -> SportProfileOut:
    """Добавляет сертификат антидопингового курса РУСАДА."""
    return _out(await profiles.add_antidoping(user.id, body.passed_on, body.certificate_url, body.file_id, ip))


@router.delete("/antidoping/{certificate_id}", summary="Удалить отметку")
async def remove_antidoping(
    certificate_id: Annotated[UUID, Path()], user: CurrentUserDep, profiles: SportProfilesDep
) -> SportProfileOut:
    """Удаляет сертификат антидопингового курса."""
    return _out(await profiles.remove_antidoping(user.id, certificate_id))
