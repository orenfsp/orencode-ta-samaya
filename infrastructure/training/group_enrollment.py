import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.enums import EnrollmentEnd
from infrastructure.training.training_group import TrainingGroupModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class GroupEnrollmentModel(Base):
    __tablename__ = "group_enrollments"
    __table_args__ = (
        Index("uq_group_enrollments_open", "group_id", "athlete_id", unique=True, postgresql_where=text("valid_to IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    group_id: Mapped[int] = mapped_column(ForeignKey("training_groups.id", ondelete="CASCADE"), index=True)
    athlete_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)
    end_reason: Mapped[EnrollmentEnd | None] = mapped_column(Enum(EnrollmentEnd, name="enrollment_end", values_callable=_values))
    order_number: Mapped[str | None] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(Text)
    previous_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("group_enrollments.id", ondelete="SET NULL"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group: Mapped[TrainingGroupModel] = relationship(
        lazy="selectin",
    )

    athlete: Mapped[UserModel] = relationship(
        foreign_keys=[athlete_id],
        lazy="selectin",
    )
