from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class StandardNormDisciplineModel(Base):
    __tablename__ = "standard_norm_disciplines"

    norm_id: Mapped[int] = mapped_column(ForeignKey("standard_norms.id", ondelete="CASCADE"), primary_key=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"), primary_key=True, index=True)
