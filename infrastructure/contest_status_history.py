import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.user import UserModel


class ContestStatusHistoryModel(Base):
    __tablename__ = "contest_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    from_value: Mapped[str | None] = mapped_column(String(50))
    to_value: Mapped[str] = mapped_column(String(50))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[UserModel | None] = relationship(lazy="selectin")
