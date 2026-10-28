from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryAcademicGroupModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_academic_groups"
    __table_args__ = dictionary_table_args("dictionary_academic_groups")
