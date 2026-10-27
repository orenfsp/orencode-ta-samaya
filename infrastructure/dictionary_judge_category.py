from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryJudgeCategoryModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_judge_categories"
    __table_args__ = dictionary_table_args("dictionary_judge_categories")

    validity_months: Mapped[int | None] = mapped_column()
