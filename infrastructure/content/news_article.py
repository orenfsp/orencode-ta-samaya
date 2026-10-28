import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base


class NewsArticleModel(Base):
    __tablename__ = "news_articles"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'archived')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    section: Mapped[str | None] = mapped_column(String(100))
    summary: Mapped[str | None] = mapped_column(String(500))
    cover_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    blocks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    hashtags: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    views: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
