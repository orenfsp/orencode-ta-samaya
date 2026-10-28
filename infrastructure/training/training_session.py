import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.enums import SessionFormat
from infrastructure.services.file import FileModel
from infrastructure.training.session_attendance import SessionAttendanceModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class TrainingSessionModel(Base):
    __tablename__ = "training_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    group_id: Mapped[int] = mapped_column(ForeignKey("training_groups.id", ondelete="CASCADE"), index=True)
    held_on: Mapped[date] = mapped_column(Date, index=True)
    topic: Mapped[str] = mapped_column(String(300))
    format: Mapped[SessionFormat] = mapped_column(Enum(SessionFormat, name="session_format", values_callable=_values))
    proof_url: Mapped[str | None] = mapped_column(String(500))
    proof_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    proof_file: Mapped[FileModel | None] = relationship(
        lazy="selectin",
    )

    attendance: Mapped[list[SessionAttendanceModel]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
    )
