from sqlalchemy import Column, ForeignKey, Integer, Table

from infrastructure.base import Base

contest_academic_groups = Table(
    "contest_academic_groups",
    Base.metadata,
    Column("contest_id", Integer, ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True),
    Column("academic_group_id", Integer, ForeignKey("dictionary_academic_groups.id", ondelete="RESTRICT"), primary_key=True),
)
