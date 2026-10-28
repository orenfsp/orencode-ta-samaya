from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel


class EvskRuleModel(Base):
    __tablename__ = "evsk_rules"
    __table_args__ = (
        CheckConstraint("place_to >= 1", name="ck_evsk_rules_place"),
        CheckConstraint("min_participants >= 0", name="ck_evsk_rules_participants"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rank_type_id: Mapped[int] = mapped_column(ForeignKey("dictionary_rank_types.id", ondelete="CASCADE"), index=True)
    contest_level_id: Mapped[int] = mapped_column(ForeignKey("dictionary_contest_levels.id", ondelete="RESTRICT"))
    discipline_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"))
    place_to: Mapped[int] = mapped_column(Integer)
    min_participants: Mapped[int] = mapped_column(Integer, default=0)
    min_age: Mapped[int | None] = mapped_column(Integer)
    max_age: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(String(300))
    is_demo: Mapped[bool] = mapped_column(default=True, server_default=true())
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rank_type: Mapped[DictionaryRankTypeModel] = relationship(
        lazy="selectin",
    )

    contest_level: Mapped[DictionaryContestLevelModel] = relationship(
        lazy="selectin",
    )

    discipline: Mapped[DictionaryDisciplineModel | None] = relationship(
        lazy="selectin",
    )
