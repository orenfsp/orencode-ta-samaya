import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base


class SessionAttendanceModel(Base):
    __tablename__ = "session_attendance"

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"), primary_key=True)
    athlete_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    present: Mapped[bool] = mapped_column(default=True)

    athlete: Mapped[UserModel] = relationship(
        lazy="selectin",
    )
