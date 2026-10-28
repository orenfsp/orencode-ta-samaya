import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base
from infrastructure.enums import RatingSeason


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class RatingSettingModel(Base):
    __tablename__ = "rating_settings"
    __table_args__ = (
        CheckConstraint("stability_factor >= 1 AND stability_factor <= 3", name="ck_rating_settings_factor"),
        CheckConstraint("podium_place >= 1 AND podium_count >= 1", name="ck_rating_settings_podium"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stability_factor: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("1.20"))
    podium_place: Mapped[int] = mapped_column(Integer, default=3)
    podium_count: Mapped[int] = mapped_column(Integer, default=2)
    season: Mapped[RatingSeason] = mapped_column(Enum(RatingSeason, name="rating_season", values_callable=_values), default=RatingSeason.ROLLING)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
