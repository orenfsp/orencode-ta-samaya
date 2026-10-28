import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base
from infrastructure.enums import Channel, EmailStatus


class OutboxModel(Base):
    __tablename__ = "outbox"
    __table_args__ = (
        Index("ix_outbox_due", "status", "next_attempt_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    channel: Mapped[Channel] = mapped_column(Enum(Channel, name="channel", values_callable=lambda cls: [value.value for value in cls]), default=Channel.EMAIL)
    notification_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("notifications.id", ondelete="SET NULL"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(100))
    recipient: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(2000))
    code: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[EmailStatus] = mapped_column(Enum(EmailStatus, name="email_status", values_callable=lambda cls: [value.value for value in cls]), default=EmailStatus.PENDING)
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lease_token: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    leased_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
