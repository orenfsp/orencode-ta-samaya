import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class FileModel(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    object_key: Mapped[str] = mapped_column(String(500), unique=True)
    is_public: Mapped[bool] = mapped_column(default=False, server_default=false())
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column()
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
