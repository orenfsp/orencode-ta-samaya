import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base
from infrastructure.enums import EmailStatus


class NotificationModel(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(1000))
    is_read: Mapped[bool] = mapped_column(default=False, server_default=false())
    email_status: Mapped[EmailStatus] = mapped_column(Enum(EmailStatus, name="email_status", values_callable=lambda cls: [value.value for value in cls]), default=EmailStatus.NOT_REQUIRED)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
