from sqlalchemy import CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryAgeGroupModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_age_groups"
    __table_args__ = dictionary_table_args("dictionary_age_groups", CheckConstraint("min_age IS NOT NULL OR max_age IS NOT NULL", name="ck_dictionary_age_groups_has_bound"), CheckConstraint("min_age IS NULL OR max_age IS NULL OR max_age >= min_age", name="ck_dictionary_age_groups_range"))

    min_age: Mapped[int | None] = mapped_column()
    max_age: Mapped[int | None] = mapped_column()
