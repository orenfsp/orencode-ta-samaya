import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base

ORENBURG = timezone(timedelta(hours=5))


def local_date(moment: datetime) -> date:
    return moment.astimezone(ORENBURG).date()


class CalendarEventModel(Base):
    __tablename__ = "calendar_events"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at"),
        CheckConstraint("status IN ('draft', 'published', 'archived')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str | None] = mapped_column(String(500))
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    registration_url: Mapped[str | None] = mapped_column(String(2048))
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
