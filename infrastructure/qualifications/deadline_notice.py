import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class DeadlineNoticeModel(Base):
    __tablename__ = "deadline_notices"
    __table_args__ = (
        UniqueConstraint("qualification_id", "threshold_days", name="uq_deadline_notices_threshold"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    qualification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("qualifications.id", ondelete="CASCADE"))
    threshold_days: Mapped[int] = mapped_column(Integer)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
