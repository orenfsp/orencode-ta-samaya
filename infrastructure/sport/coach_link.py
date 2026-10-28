import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import CoachLinkStatus
from infrastructure.sport.coach_link_event import CoachLinkEventModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class CoachLinkModel(Base):
    __tablename__ = "coach_links"
    __table_args__ = (
        Index("uq_coach_links_open", "coach_id", "athlete_id", "discipline_id", unique=True, postgresql_where=text("status IN ('requested', 'active', 'suspended')")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    athlete_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"))
    status: Mapped[CoachLinkStatus] = mapped_column(Enum(CoachLinkStatus, name="coach_link_status", values_callable=_values), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    coach: Mapped[UserModel] = relationship(
        foreign_keys=[coach_id],
        lazy="selectin",
    )

    athlete: Mapped[UserModel] = relationship(
        foreign_keys=[athlete_id],
        lazy="selectin",
    )

    discipline: Mapped[DictionaryDisciplineModel] = relationship(
        lazy="selectin",
    )

    events: Mapped[list[CoachLinkEventModel]] = relationship(
        lazy="selectin",
        order_by=CoachLinkEventModel.created_at,
        cascade="all, delete-orphan",
    )
