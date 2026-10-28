from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryContestLevelModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_contest_levels"
    __table_args__ = dictionary_table_args("dictionary_contest_levels")
