import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, false, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import MemberConfirmation
from infrastructure.account.user import UserModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class ContestApplicationMemberModel(Base):
    __tablename__ = "contest_application_members"
    __table_args__ = (
        Index("uq_contest_application_members_active", "contest_id", "user_id", unique=True, postgresql_where=text("is_active")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("contest_applications.id", ondelete="CASCADE"), index=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    is_captain: Mapped[bool] = mapped_column(default=False, server_default=false())
    confirmation: Mapped[MemberConfirmation] = mapped_column(Enum(MemberConfirmation, name="member_confirmation", values_callable=_values))
    is_active: Mapped[bool] = mapped_column(default=True)
    age_group_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_age_groups.id", ondelete="RESTRICT"))
    academic_group_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_academic_groups.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[UserModel] = relationship(
        lazy="selectin",
    )

    age_group: Mapped[DictionaryAgeGroupModel | None] = relationship(
        lazy="selectin",
    )

    academic_group: Mapped[DictionaryAcademicGroupModel | None] = relationship(
        lazy="selectin",
    )
