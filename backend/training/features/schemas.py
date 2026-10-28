from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from infrastructure.account.user import UserModel
from infrastructure.enums import (
    ATTESTATION_RESULT_TITLES, ENROLLMENT_END_TITLES, NORM_DIRECTION_TITLES, NORM_KIND_TITLES, NORM_UNIT_TITLES,
    SESSION_FORMAT_TITLES, TRAINING_STAGE_TITLES, AttestationResult, EnrollmentEnd, NormDirection, NormKind, NormUnit,
    SessionFormat, TrainingStage,
)
from infrastructure.training.attestation import AttestationModel
from infrastructure.training.group_enrollment import GroupEnrollmentModel
from infrastructure.training.norm_result import NormResultModel
from infrastructure.training.standard_norm import StandardNormModel
from infrastructure.training.training_group import TrainingGroupModel
from infrastructure.training.training_session import TrainingSessionModel
from training.domain.access import full_name
from training.domain.norms import NormStatus, Readiness

Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500, pattern=r"^https?://")]


class RefOut(BaseModel):
    id: int
    name: str


class PersonOut(BaseModel):
    id: UUID
    name: str

    @classmethod
    def of(cls, user: UserModel) -> "PersonOut":
        """Строит краткую схему человека."""
        return cls(id=user.id, name=full_name(user))


class StageOut(BaseModel):
    value: TrainingStage
    title: str

    @classmethod
    def of(cls, stage: TrainingStage) -> "StageOut":
        """Этап подготовки с русским названием."""
        return cls(value=stage, title=TRAINING_STAGE_TITLES[stage])


class GroupOut(BaseModel):
    id: int
    name: str
    organization: RefOut
    discipline: RefOut
    stage: StageOut
    coach: PersonOut
    start_year: int
    is_active: bool
    size: int = 0

    @classmethod
    def of(cls, item: TrainingGroupModel, size: int = 0) -> "GroupOut":
        """Строит схему группы."""
        return cls(
            id=item.id, name=item.name,
            organization=RefOut(id=item.organization.id, name=item.organization.short_name or item.organization.name),
            discipline=RefOut(id=item.discipline.id, name=item.discipline.name), stage=StageOut.of(item.stage),
            coach=PersonOut.of(item.coach), start_year=item.start_year, is_active=item.is_active, size=size,
        )


class EnrollmentOut(BaseModel):
    id: UUID
    athlete: PersonOut
    group: GroupOut
    valid_from: date
    valid_to: date | None
    end_reason: EnrollmentEnd | None
    end_reason_title: str | None
    order_number: str | None
    note: str | None
    previous_id: UUID | None

    @classmethod
    def of(cls, item: GroupEnrollmentModel) -> "EnrollmentOut":
        """Строит схему зачисления."""
        return cls(
            id=item.id, athlete=PersonOut.of(item.athlete), group=GroupOut.of(item.group), valid_from=item.valid_from,
            valid_to=item.valid_to, end_reason=item.end_reason,
            end_reason_title=ENROLLMENT_END_TITLES[item.end_reason] if item.end_reason else None,
            order_number=item.order_number, note=item.note, previous_id=item.previous_id,
        )


class GroupDetailOut(BaseModel):
    group: GroupOut
    current: list[EnrollmentOut]
    history: list[EnrollmentOut]


class GroupIn(BaseModel):
    organization_id: int | None = Field(default=None, ge=1)
    discipline_id: int | None = Field(default=None, ge=1)
    stage: TrainingStage | None = None
    coach_id: UUID | None = None
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)] | None = None
    start_year: int | None = None
    is_active: bool | None = None


class MoveIn(BaseModel):
    on: date
    order_number: Short | None = None
    note: Note | None = None


class EnrollIn(MoveIn):
    athlete_id: UUID


class TransferIn(MoveIn):
    target_group_id: int = Field(ge=1)


class MarkIn(BaseModel):
    athlete_id: UUID
    present: bool


class SessionIn(BaseModel):
    held_on: date
    topic: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    format: SessionFormat
    proof_url: Url | None = None
    proof_file_id: UUID | None = None
    note: Note | None = None
    attendance: list[MarkIn] = Field(default_factory=list, max_length=200)


class RefFile(BaseModel):
    id: UUID
    name: str


class MarkOut(BaseModel):
    athlete: PersonOut
    present: bool


class SessionOut(BaseModel):
    id: UUID
    group_id: int
    held_on: date
    topic: str
    format: SessionFormat
    format_title: str
    proof_url: str | None
    proof_file: RefFile | None = None
    note: str | None
    present: int
    marks: list[MarkOut]
    created_at: datetime

    @classmethod
    def of(cls, item: TrainingSessionModel) -> "SessionOut":
        """Строит схему занятия с отметками посещения."""
        return cls(
            id=item.id, group_id=item.group_id, held_on=item.held_on, topic=item.topic, format=item.format,
            format_title=SESSION_FORMAT_TITLES[item.format], proof_url=item.proof_url,
            proof_file=RefFile(id=item.proof_file.id, name=item.proof_file.original_name) if item.proof_file else None,
            note=item.note, present=sum(1 for mark in item.attendance if mark.present),
            marks=sorted((MarkOut(athlete=PersonOut.of(mark.athlete), present=mark.present) for mark in item.attendance),
                         key=lambda mark: mark.athlete.name),
            created_at=item.created_at,
        )


class JournalOut(BaseModel):
    group: GroupOut
    sessions: list[SessionOut]


class AttendanceOut(BaseModel):
    total: int
    attended: int
    sessions: list[SessionOut]
    groups: list[GroupOut]


class NormOut(BaseModel):
    id: int
    stage: StageOut
    kind: NormKind
    kind_title: str
    name: str
    unit: NormUnit
    unit_title: str
    direction: NormDirection
    direction_title: str
    threshold_male: Decimal | None
    threshold_female: Decimal | None
    disciplines: list[RefOut]
    source: str
    is_demo: bool
    is_archived: bool
    sort_order: int

    @classmethod
    def of(cls, item: StandardNormModel) -> "NormOut":
        """Строит схему норматива."""
        return cls(
            id=item.id, stage=StageOut.of(item.stage), kind=item.kind, kind_title=NORM_KIND_TITLES[item.kind],
            name=item.name, unit=item.unit, unit_title=NORM_UNIT_TITLES[item.unit], direction=item.direction,
            direction_title=NORM_DIRECTION_TITLES[item.direction], threshold_male=item.threshold_male,
            threshold_female=item.threshold_female,
            disciplines=[RefOut(id=d.id, name=d.name) for d in item.disciplines], source=item.source,
            is_demo=item.is_demo, is_archived=item.is_archived, sort_order=item.sort_order,
        )


class NormIn(BaseModel):
    stage: TrainingStage | None = None
    kind: NormKind | None = None
    name: Text | None = None
    unit: NormUnit | None = None
    direction: NormDirection | None = None
    threshold_male: Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    threshold_female: Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    discipline_ids: list[int] | None = Field(default=None, max_length=20)
    source: Text | None = None
    is_demo: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)
    is_archived: bool | None = None


class ResultIn(BaseModel):
    athlete_id: UUID
    norm_id: int = Field(ge=1)
    value: Decimal = Field(max_digits=10, decimal_places=2)
    passed_on: date


class ResultsIn(BaseModel):
    items: list[ResultIn] = Field(min_length=1, max_length=500)


class ResultOut(BaseModel):
    id: UUID
    athlete_id: UUID
    norm: NormOut
    value: Decimal
    threshold: Decimal
    passed: bool
    passed_on: date
    recorded_by: PersonOut | None

    @classmethod
    def of(cls, item: NormResultModel) -> "ResultOut":
        """Строит схему результата сдачи."""
        return cls(
            id=item.id, athlete_id=item.athlete_id, norm=NormOut.of(item.norm), value=item.value,
            threshold=item.threshold, passed=item.passed, passed_on=item.passed_on,
            recorded_by=PersonOut.of(item.recorder) if item.recorder else None,
        )


class AttestationOut(BaseModel):
    id: UUID
    athlete_id: UUID
    athlete: PersonOut
    group: GroupOut
    target_group: GroupOut | None
    stage_from: StageOut
    stage_to: StageOut | None
    result: AttestationResult
    result_title: str
    decided_on: date
    order_number: str | None
    comment: str | None
    is_override: bool
    actor: PersonOut | None

    @classmethod
    def of(cls, item: AttestationModel) -> "AttestationOut":
        """Строит схему аттестации."""
        return cls(
            id=item.id, athlete_id=item.athlete_id, athlete=PersonOut.of(item.athlete), group=GroupOut.of(item.group),
            target_group=GroupOut.of(item.target_group) if item.target_group else None,
            stage_from=StageOut.of(item.stage_from), stage_to=StageOut.of(item.stage_to) if item.stage_to else None,
            result=item.result, result_title=ATTESTATION_RESULT_TITLES[item.result], decided_on=item.decided_on,
            order_number=item.order_number, comment=item.comment, is_override=item.is_override,
            actor=PersonOut.of(item.actor) if item.actor else None,
        )


class HistoryOut(BaseModel):
    athlete: str
    results: list[ResultOut]
    attestations: list[AttestationOut]


class NormStatusOut(BaseModel):
    norm: NormOut
    threshold: Decimal | None
    state: str
    best: Decimal | None
    best_on: date | None

    @classmethod
    def of(cls, item: NormStatus) -> "NormStatusOut":
        """Строит состояние норматива у спортсмена."""
        return cls(norm=NormOut.of(item.norm), threshold=item.threshold, state=item.state,
                   best=item.best.value if item.best else None, best_on=item.best.passed_on if item.best else None)


class BoardRowOut(BaseModel):
    enrollment_id: UUID
    athlete: PersonOut
    since: date
    ready: bool
    passed: int
    required: int
    norms: list[NormStatusOut]

    @classmethod
    def of(cls, enrollment: GroupEnrollmentModel, row: Readiness) -> "BoardRowOut":
        """Строит строку аттестационной ведомости."""
        return cls(
            enrollment_id=enrollment.id, athlete=PersonOut.of(enrollment.athlete), since=enrollment.valid_from,
            ready=row.ready, passed=sum(1 for item in row.norms if item.state == "passed"), required=len(row.norms),
            norms=[NormStatusOut.of(item) for item in row.norms],
        )


class BoardOut(BaseModel):
    group: GroupOut
    target_stage: StageOut | None
    rows: list[BoardRowOut]
    targets: list[GroupOut]
    history: list[AttestationOut]


class DecisionIn(BaseModel):
    athlete_id: UUID
    group_id: int = Field(ge=1)
    result: AttestationResult
    target_group_id: int | None = Field(default=None, ge=1)
    on: date
    order_number: Short | None = None
    comment: Note | None = None


class ProgramOut(BaseModel):
    id: int
    discipline: RefOut
    stage: StageOut
    valid_from: date


class CoachOut(BaseModel):
    id: int
    coach: PersonOut
    position: str
    valid_from: date


class ProgramIn(BaseModel):
    discipline_id: int = Field(ge=1)
    stage: TrainingStage


class CoachIn(BaseModel):
    coach_id: UUID
    position: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)] = "Тренер-преподаватель"


class CardOut(BaseModel):
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
    programs: list[ProgramOut]
    coaches: list[CoachOut]
    groups: list[GroupOut]
    athletes: int
