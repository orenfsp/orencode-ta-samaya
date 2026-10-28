import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.contests.contest import ContestModel
from infrastructure.disputes.appeal_file import appeal_files
from infrastructure.enums import AppealStatus
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.services.file import FileModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class AppealModel(Base):
    __tablename__ = "appeals"
    __table_args__ = (
        Index("uq_appeals_open", "application_id", unique=True, postgresql_where=text("status IN ('submitted', 'reviewing')")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("contest_applications.id", ondelete="CASCADE"), index=True)
    filed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    current_place: Mapped[int | None] = mapped_column(Integer)
    requested_place: Mapped[int | None] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[AppealStatus] = mapped_column(Enum(AppealStatus, name="appeal_status", values_callable=_values), index=True)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decision: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contest: Mapped[ContestModel] = relationship(
        lazy="selectin",
    )

    application: Mapped[ContestApplicationModel] = relationship(
        lazy="selectin",
    )

    filer: Mapped[UserModel] = relationship(
        foreign_keys=[filed_by],
        lazy="selectin",
    )

    files: Mapped[list[FileModel]] = relationship(
        secondary=appeal_files,
        lazy="selectin",
    )
