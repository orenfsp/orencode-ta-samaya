import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.contests.contest import ContestModel
from infrastructure.disputes.violation_file import violation_files
from infrastructure.enums import Sanction, ViolationStatus
from infrastructure.services.file import FileModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class ViolationModel(Base):
    __tablename__ = "violations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("contest_applications.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reported_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[ViolationStatus] = mapped_column(Enum(ViolationStatus, name="violation_status", values_callable=_values), index=True)
    sanction: Mapped[Sanction | None] = mapped_column(Enum(Sanction, name="sanction", values_callable=_values))
    suspended_until: Mapped[date | None] = mapped_column(Date, index=True)
    decision: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contest: Mapped[ContestModel] = relationship(
        lazy="selectin",
    )

    user: Mapped[UserModel] = relationship(
        foreign_keys=[user_id],
        lazy="selectin",
    )

    reporter: Mapped[UserModel] = relationship(
        foreign_keys=[reported_by],
        lazy="selectin",
    )

    files: Mapped[list[FileModel]] = relationship(
        secondary=violation_files,
        lazy="selectin",
    )
