import uuid

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class NewsHashtagModel(Base):
    __tablename__ = "news_hashtags"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True)
