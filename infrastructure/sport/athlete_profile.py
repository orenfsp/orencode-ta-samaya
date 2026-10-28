import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.enums import Sex, TrainingStage
from infrastructure.sport.organization import OrganizationModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class AthleteProfileModel(Base):
    __tablename__ = "athlete_profiles"
    __table_args__ = (
        CheckConstraint("start_year IS NULL OR start_year >= 1950", name="ck_athlete_profiles_start_year"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    sex: Mapped[Sex | None] = mapped_column(Enum(Sex, name="sex", values_callable=_values))
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="RESTRICT"), index=True)
    no_organization: Mapped[bool] = mapped_column(default=False)
    start_year: Mapped[int | None] = mapped_column(Integer)
    training_stage: Mapped[TrainingStage | None] = mapped_column(Enum(TrainingStage, name="training_stage", values_callable=_values))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization: Mapped[OrganizationModel | None] = relationship(
        lazy="selectin",
    )
