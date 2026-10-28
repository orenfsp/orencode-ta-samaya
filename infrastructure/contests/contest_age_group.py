from sqlalchemy import Column, ForeignKey, Integer, Table

from infrastructure.base import Base

contest_age_groups = Table(
    "contest_age_groups",
    Base.metadata,
    Column("contest_id", Integer, ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True),
    Column("age_group_id", Integer, ForeignKey("dictionary_age_groups.id", ondelete="RESTRICT"), primary_key=True),
)
