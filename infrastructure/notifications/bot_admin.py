import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.enums import BotAdminLevel
from infrastructure.account.user import UserModel


class BotAdminModel(Base):
    __tablename__ = "bot_admins"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[BotAdminLevel] = mapped_column(Enum(BotAdminLevel, name="bot_admin_level", values_callable=lambda cls: [value.value for value in cls]))
    granted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[UserModel] = relationship(
        foreign_keys=[user_id],
        lazy="selectin",
    )

    granter: Mapped[UserModel | None] = relationship(
        foreign_keys=[granted_by],
        lazy="selectin",
    )
