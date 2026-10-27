from sqlalchemy import Column, ForeignKey, Table, Uuid

from infrastructure.base import Base

news_article_hashtags = Table(
    "news_article_hashtags",
    Base.metadata,
    Column("article_id", Uuid, ForeignKey("news_articles.id", ondelete="CASCADE"), primary_key=True),
    Column("hashtag_id", Uuid, ForeignKey("news_hashtags.id", ondelete="CASCADE"), primary_key=True),
)
