from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.qualification import QualificationModel
from qualifications.features.schemas import PersonOut


class CategoryOut(BaseModel):
    name: str
    valid_until: date | None

    @classmethod
    def of(cls, item: QualificationModel | None) -> "CategoryOut | None":
        """Строит схему категории из заявки; None, если категории нет."""
        return cls(name=item.item_name, valid_until=item.valid_until) if item else None


class PositionOut(BaseModel):
    id: int
    name: str


class AssignmentOut(BaseModel):
    id: UUID
    judge: PersonOut
    position: PositionOut
    category: CategoryOut | None

    @classmethod
    def of(cls, item: JudgeAssignmentModel, category: QualificationModel | None) -> "AssignmentOut":
        """Строит схему назначения судьи из доменной модели."""
        return cls(
            id=item.id,
            judge=PersonOut.of(item.judge),
            position=PositionOut(id=item.position.id, name=item.position.name),
            category=CategoryOut.of(category),
        )


class PanelOut(BaseModel):
    contest_id: int
    starts_on: date
    items: list[AssignmentOut]


class CandidateOut(BaseModel):
    judge: PersonOut
    category: CategoryOut | None


class AssignIn(BaseModel):
    judge_id: UUID
    position_id: int = Field(ge=1)


class PositionIn(BaseModel):
    position_id: int = Field(ge=1)


class ContestRefOut(BaseModel):
    id: int
    title: str
    starts_on: date
    ends_on: date
    status: str


class MyAssignmentOut(BaseModel):
    id: UUID
    contest: ContestRefOut
    position: PositionOut
