from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryDisciplineModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_disciplines"
    __table_args__ = dictionary_table_args("dictionary_disciplines")
