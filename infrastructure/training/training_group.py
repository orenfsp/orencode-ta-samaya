import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import TrainingStage
from infrastructure.sport.organization import OrganizationModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class TrainingGroupModel(Base):
    __tablename__ = "training_groups"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_training_groups_organization_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="RESTRICT"), index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"), index=True)
    stage: Mapped[TrainingStage] = mapped_column(Enum(TrainingStage, name="training_stage", values_callable=_values), index=True)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    start_year: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization: Mapped[OrganizationModel] = relationship(
        lazy="selectin",
    )

    discipline: Mapped[DictionaryDisciplineModel] = relationship(
        lazy="selectin",
    )

    coach: Mapped[UserModel] = relationship(
        lazy="selectin",
    )
