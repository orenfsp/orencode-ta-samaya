from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryContestTypeModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_contest_types"
    __table_args__ = dictionary_table_args("dictionary_contest_types")
