from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryOrganizationTypeModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_organization_types"
    __table_args__ = dictionary_table_args("dictionary_organization_types")
