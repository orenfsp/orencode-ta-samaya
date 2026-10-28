import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint, Uuid, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.enums import WallRole
from infrastructure.services.file import FileModel
from infrastructure.account.wall_post_photo import WallPostPhotoModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class WallPostModel(Base):
    __tablename__ = "wall_posts"
    __table_args__ = (
        UniqueConstraint("user_id", "role", "contest_id", name="uq_wall_posts_user_role_contest"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[WallRole] = mapped_column(Enum(WallRole, name="wall_role", values_callable=_values))
    contest_id: Mapped[int] = mapped_column(Integer, ForeignKey("contests.id", ondelete="CASCADE"))
    text: Mapped[str | None] = mapped_column(Text)
    is_hidden: Mapped[bool] = mapped_column(default=False, server_default=false())
    hidden_by_federation: Mapped[bool] = mapped_column(default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    photos: Mapped[list[WallPostPhotoModel]] = relationship(
        lazy="selectin",
        order_by=WallPostPhotoModel.position,
        cascade="all, delete-orphan",
    )

    @property
    def photo_files(self) -> list[FileModel]:
        """Файлы фотографий записи в порядке их позиции."""
        return [photo.file for photo in self.photos]
