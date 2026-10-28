from infrastructure.base import Base, DictionaryColumns, dictionary_table_args


class DictionaryJudgePositionModel(DictionaryColumns, Base):
    __tablename__ = "dictionary_judge_positions"
    __table_args__ = dictionary_table_args("dictionary_judge_positions")
