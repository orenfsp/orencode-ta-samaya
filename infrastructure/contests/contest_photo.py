import uuid

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.services.file import FileModel


class ContestPhotoModel(Base):
    __tablename__ = "contest_photos"

    contest_id: Mapped[int] = mapped_column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column()

    file: Mapped[FileModel] = relationship(
        lazy="selectin",
    )
