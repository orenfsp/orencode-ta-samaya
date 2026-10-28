from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.enums import COACH_LINK_STATUS_TITLES, TRAINING_STAGE_TITLES, CoachLinkStatus, Sex, TrainingStage
from infrastructure.sport.organization import OrganizationModel
from infrastructure.account.user import UserModel
from profiles.domain.organizations import mask_inn

Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Comment = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class RefOut(BaseModel):
    id: int
    name: str


class PersonOut(BaseModel):
    id: UUID
    name: str
    birth_date: date

    @classmethod
    def of(cls, user: UserModel) -> "PersonOut":
        """Строит краткую схему человека."""
        name = " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)
        return cls(id=user.id, name=name, birth_date=user.birth_date)


class OrganizationOut(BaseModel):
    id: int
    name: str
    short_name: str | None
    organization_type: RefOut
    municipality: RefOut | None
    inn: str | None
    address: str | None
    website: str | None
    license_number: str | None
    license_date: date | None
    is_active: bool
    athletes: int = 0

    @classmethod
    def of(cls, item: OrganizationModel, athletes: int = 0, full: bool = False) -> "OrganizationOut":
        """Строит схему организации; ИНН полностью — только в полной версии."""
        return cls(
            id=item.id,
            name=item.name,
            short_name=item.short_name,
            organization_type=RefOut(id=item.organization_type.id, name=item.organization_type.name),
            municipality=RefOut(id=item.municipality.id, name=item.municipality.name) if item.municipality else None,
            inn=item.inn if full else mask_inn(item.inn),
            address=item.address,
            website=item.website,
            license_number=item.license_number,
            license_date=item.license_date,
            is_active=item.is_active,
            athletes=athletes,
        )


class OrganizationIn(BaseModel):
    name: Text | None = Field(default=None, min_length=2)
    short_name: Text | None = None
    organization_type_id: int | None = Field(default=None, ge=1)
    municipality_id: int | None = Field(default=None, ge=1)
    inn: Annotated[str, StringConstraints(strip_whitespace=True, max_length=12)] | None = None
    address: Text | None = None
    website: Text | None = None
    license_number: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    license_date: date | None = None
    is_active: bool | None = None


class LinkEventOut(BaseModel):
    status: CoachLinkStatus
    status_title: str
    actor: str | None
    comment: str | None
    created_at: datetime


class LinkOut(BaseModel):
    id: UUID
    coach: PersonOut
    athlete: PersonOut
    discipline: RefOut
    status: CoachLinkStatus
    status_title: str
    created_at: datetime
    updated_at: datetime
    events: list[LinkEventOut]

    @classmethod
    def of(cls, link: CoachLinkModel) -> "LinkOut":
        """Строит схему связи тренер ↔ спортсмен с историей."""
        return cls(
            id=link.id,
            coach=PersonOut.of(link.coach),
            athlete=PersonOut.of(link.athlete),
            discipline=RefOut(id=link.discipline.id, name=link.discipline.name),
            status=link.status,
            status_title=COACH_LINK_STATUS_TITLES[link.status],
            created_at=link.created_at,
            updated_at=link.updated_at,
            events=[
                LinkEventOut(
                    status=event.status,
                    status_title=COACH_LINK_STATUS_TITLES[event.status],
                    actor=f"{event.actor.last_name} {event.actor.first_name}" if event.actor else None,
                    comment=event.comment,
                    created_at=event.created_at,
                )
                for event in link.events
            ],
        )


class StageOut(BaseModel):
    value: TrainingStage
    title: str

    @classmethod
    def of(cls, stage: TrainingStage | None) -> "StageOut | None":
        """Строит схему этапа подготовки или None."""
        return cls(value=stage, title=TRAINING_STAGE_TITLES[stage]) if stage else None


class AntidopingOut(BaseModel):
    id: UUID
    passed_on: date
    valid_until: date
    certificate_url: str | None
    file_url: str | None


class OrganizationPeriodOut(BaseModel):
    organization: str
    valid_from: date
    valid_to: date | None


class SportProfileOut(BaseModel):
    municipality: RefOut | None
    sex: Sex | None
    organization: RefOut | None
    no_organization: bool
    start_year: int | None
    training_stage: StageOut | None
    disciplines: list[RefOut]
    organization_history: list[OrganizationPeriodOut]
    coaches: list[LinkOut]
    antidoping: list[AntidopingOut]


class SportProfileIn(BaseModel):
    municipality_id: int | None = Field(default=None, ge=1)
    sex: Sex | None = None
    organization_id: int | None = Field(default=None, ge=1)
    no_organization: bool = False
    start_year: int | None = None
    training_stage: TrainingStage | None = None
    discipline_ids: list[int] = Field(default_factory=list, max_length=10)


class AntidopingIn(BaseModel):
    passed_on: date
    certificate_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://")] | None = None
    file_id: UUID | None = None


class LinkRequestIn(BaseModel):
    athlete_id: UUID
    discipline_id: int = Field(ge=1)
    comment: Comment | None = None


class LinkActionIn(BaseModel):
    comment: Comment | None = None


class CandidateOut(BaseModel):
    athlete: PersonOut
    municipality: str | None
    linked: bool


class MyLinksOut(BaseModel):
    as_coach: list[LinkOut]
    as_athlete: list[LinkOut]


class OrganizationPage(BaseModel):
    items: list[OrganizationOut]
    total: int
