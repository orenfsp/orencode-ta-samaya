import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Text, UniqueConstraint, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.enums import Role, RoleStatus
from infrastructure.user import UserModel


def _enum_values(enum_cls: type[StrEnum]) -> list[str]:
    return [item.value for item in enum_cls]


RoleColumn = Enum(Role, name="role", values_callable=_enum_values)
RoleStatusColumn = Enum(RoleStatus, name="role_status", values_callable=_enum_values)


class UserRoleModel(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[Role] = mapped_column(RoleColumn)
    status: Mapped[RoleStatus] = mapped_column(RoleStatusColumn, index=True)
    reject_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    onboarding_done: Mapped[bool] = mapped_column(default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[UserModel] = relationship(back_populates="roles", foreign_keys=[user_id], lazy="raise")
    decider: Mapped[UserModel | None] = relationship(foreign_keys=[decided_by], lazy="raise")
