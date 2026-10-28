import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class AntidopingCertificateModel(Base):
    __tablename__ = "antidoping_certificates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    passed_on: Mapped[date] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date, index=True)
    certificate_url: Mapped[str | None] = mapped_column()
    file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
