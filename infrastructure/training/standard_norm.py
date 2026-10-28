from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, Integer, Numeric, String, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import NormDirection, NormKind, NormUnit, TrainingStage
from infrastructure.training.standard_norm_discipline import StandardNormDisciplineModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class StandardNormModel(Base):
    __tablename__ = "standard_norms"
    __table_args__ = (
        CheckConstraint("threshold_male IS NOT NULL OR threshold_female IS NOT NULL", name="ck_standard_norms_threshold"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stage: Mapped[TrainingStage] = mapped_column(Enum(TrainingStage, name="training_stage", values_callable=_values), index=True)
    kind: Mapped[NormKind] = mapped_column(Enum(NormKind, name="norm_kind", values_callable=_values))
    name: Mapped[str] = mapped_column(String(200))
    unit: Mapped[NormUnit] = mapped_column(Enum(NormUnit, name="norm_unit", values_callable=_values))
    direction: Mapped[NormDirection] = mapped_column(Enum(NormDirection, name="norm_direction", values_callable=_values))
    threshold_male: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    threshold_female: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    source: Mapped[str] = mapped_column(String(300))
    is_demo: Mapped[bool] = mapped_column(default=False, server_default=false())
    is_archived: Mapped[bool] = mapped_column(default=False, server_default=false())
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    disciplines: Mapped[list[DictionaryDisciplineModel]] = relationship(
        secondary=StandardNormDisciplineModel.__table__,
        order_by=DictionaryDisciplineModel.id,
        lazy="selectin",
    )
