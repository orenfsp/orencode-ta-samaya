from sqlalchemy import Column, ForeignKey, Table, Uuid

from infrastructure.base import Base

appeal_files = Table(
    "appeal_files",
    Base.metadata,
    Column("appeal_id", Uuid, ForeignKey("appeals.id", ondelete="CASCADE"), primary_key=True),
    Column("file_id", Uuid, ForeignKey("files.id", ondelete="RESTRICT"), primary_key=True),
)
