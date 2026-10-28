from sqlalchemy import Column, ForeignKey, Table, Uuid

from infrastructure.base import Base

violation_files = Table(
    "violation_files",
    Base.metadata,
    Column("violation_id", Uuid, ForeignKey("violations.id", ondelete="CASCADE"), primary_key=True),
    Column("file_id", Uuid, ForeignKey("files.id", ondelete="RESTRICT"), primary_key=True),
)
