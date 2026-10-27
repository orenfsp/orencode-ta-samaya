import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String, Uuid, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionary_academic_group import DictionaryAcademicGroupModel

if TYPE_CHECKING:
    from infrastructure.user_role import UserRoleModel


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    last_name: Mapped[str] = mapped_column(String(100))
    first_name: Mapped[str] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100))
    birth_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    pd_consent_version: Mapped[str] = mapped_column(String(20))
    pd_consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    academic_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("dictionary_academic_groups.id", ondelete="RESTRICT")
    )

    academic_group: Mapped[DictionaryAcademicGroupModel | None] = relationship(lazy="selectin")

    roles: Mapped[list["UserRoleModel"]] = relationship(
        back_populates="user",
        foreign_keys="UserRoleModel.user_id",
        order_by="UserRoleModel.created_at",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
