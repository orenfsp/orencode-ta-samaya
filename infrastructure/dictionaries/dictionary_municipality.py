from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryMunicipalityModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_municipalities"
    __table_args__ = dictionary_table_args("dictionary_municipalities")
