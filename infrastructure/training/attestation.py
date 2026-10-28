import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Text, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.enums import AttestationResult, TrainingStage
from infrastructure.training.training_group import TrainingGroupModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class AttestationModel(Base):
    __tablename__ = "attestations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    athlete_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("training_groups.id", ondelete="RESTRICT"), index=True)
    target_group_id: Mapped[int | None] = mapped_column(ForeignKey("training_groups.id", ondelete="RESTRICT"))
    stage_from: Mapped[TrainingStage] = mapped_column(Enum(TrainingStage, name="training_stage", values_callable=_values))
    stage_to: Mapped[TrainingStage | None] = mapped_column(Enum(TrainingStage, name="training_stage", values_callable=_values))
    result: Mapped[AttestationResult] = mapped_column(Enum(AttestationResult, name="attestation_result", values_callable=_values))
    decided_on: Mapped[date] = mapped_column(Date)
    order_number: Mapped[str | None] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(Text)
    is_override: Mapped[bool] = mapped_column(default=False, server_default=false())
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    athlete: Mapped[UserModel] = relationship(
        foreign_keys=[athlete_id],
        lazy="selectin",
    )

    group: Mapped[TrainingGroupModel] = relationship(
        foreign_keys=[group_id],
        lazy="selectin",
    )

    target_group: Mapped[TrainingGroupModel | None] = relationship(
        foreign_keys=[target_group_id],
        lazy="selectin",
    )

    actor: Mapped[UserModel | None] = relationship(
        foreign_keys=[actor_id],
        lazy="selectin",
    )
