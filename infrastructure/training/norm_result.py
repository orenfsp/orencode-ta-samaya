import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.training.standard_norm import StandardNormModel


class NormResultModel(Base):
    __tablename__ = "norm_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    athlete_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    norm_id: Mapped[int] = mapped_column(ForeignKey("standard_norms.id", ondelete="RESTRICT"), index=True)
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    threshold: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    passed: Mapped[bool] = mapped_column()
    passed_on: Mapped[date] = mapped_column(Date, index=True)
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    norm: Mapped[StandardNormModel] = relationship(
        lazy="selectin",
    )

    recorder: Mapped[UserModel | None] = relationship(
        foreign_keys=[recorded_by],
        lazy="selectin",
    )
