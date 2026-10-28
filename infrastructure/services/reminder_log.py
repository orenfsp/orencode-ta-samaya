import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class ReminderLogModel(Base):
    __tablename__ = "reminder_log"
    __table_args__ = (
        UniqueConstraint("source", "object_key", "user_id", "threshold", name="uq_reminder_log"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(40))
    object_key: Mapped[str] = mapped_column(String(80))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    threshold: Mapped[int] = mapped_column(Integer)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
