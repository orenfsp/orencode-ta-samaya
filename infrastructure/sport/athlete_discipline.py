import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel


class AthleteDisciplineModel(Base):
    __tablename__ = "athlete_disciplines"
    __table_args__ = (
        Index("uq_athlete_disciplines_open", "user_id", "discipline_id", unique=True, postgresql_where=text("valid_to IS NULL")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"), index=True)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)

    discipline: Mapped[DictionaryDisciplineModel] = relationship(
        lazy="selectin",
    )
