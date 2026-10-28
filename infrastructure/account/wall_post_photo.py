import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.services.file import FileModel


class WallPostPhotoModel(Base):
    __tablename__ = "wall_post_photos"

    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wall_posts.id", ondelete="CASCADE"), primary_key=True)
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column()

    file: Mapped[FileModel] = relationship(
        lazy="selectin",
    )
