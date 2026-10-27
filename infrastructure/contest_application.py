import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.contest import ContestModel
from infrastructure.contest_application_member import ContestApplicationMemberModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus
from infrastructure.user import UserModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    return [item.value for item in enum_cls]


class ContestApplicationModel(Base):
    __tablename__ = "contest_applications"
    __table_args__ = (
        Index(
            "uq_contest_applications_team_name",
            "contest_id",
            func.lower(text("team_name")),
            unique=True,
            postgresql_where=text("team_name IS NOT NULL AND status <> 'withdrawn'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True)
    team_name: Mapped[str | None] = mapped_column(String(100))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    created_as: Mapped[ApplicationCreator] = mapped_column(
        Enum(ApplicationCreator, name="application_creator", values_callable=_values)
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status", values_callable=_values), index=True
    )
    reject_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contest: Mapped[ContestModel] = relationship(lazy="selectin")
    creator: Mapped[UserModel] = relationship(foreign_keys=[created_by], lazy="selectin")
    decider: Mapped[UserModel | None] = relationship(foreign_keys=[decided_by], lazy="selectin")
    members: Mapped[list[ContestApplicationMemberModel]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by=[ContestApplicationMemberModel.is_captain.desc(), ContestApplicationMemberModel.id],
    )
