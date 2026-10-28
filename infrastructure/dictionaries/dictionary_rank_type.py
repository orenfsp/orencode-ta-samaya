from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base, DictionaryColumns, dictionary_table_args
from infrastructure.enums import RankKind


class DictionaryRankTypeModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_rank_types"
    __table_args__ = dictionary_table_args("dictionary_rank_types", CheckConstraint("(is_lifetime AND validity_months IS NULL) OR (NOT is_lifetime AND validity_months IS NOT NULL)", name="ck_dictionary_rank_types_validity"))

    rank_kind: Mapped[RankKind] = mapped_column(String(50))
    min_age: Mapped[int | None] = mapped_column()
    validity_months: Mapped[int | None] = mapped_column()
    is_lifetime: Mapped[bool] = mapped_column(default=False)
    valid_until_age: Mapped[int | None] = mapped_column()
