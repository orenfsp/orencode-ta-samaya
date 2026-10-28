from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Integer, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import TrainingStage


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class OrganizationProgramModel(Base):
    __tablename__ = "organization_programs"
    __table_args__ = (
        Index("uq_organization_programs_open", "organization_id", "discipline_id", "stage", unique=True, postgresql_where=text("valid_to IS NULL")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"), index=True)
    stage: Mapped[TrainingStage] = mapped_column(Enum(TrainingStage, name="training_stage", values_callable=_values))
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    discipline: Mapped[DictionaryDisciplineModel] = relationship(
        lazy="selectin",
    )
