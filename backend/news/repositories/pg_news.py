from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.news_article import NewsArticleModel
from infrastructure.news_hashtag import NewsHashtagModel


class NewsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, article_id: UUID, lock: bool = False) -> NewsArticleModel | None:
        statement = select(NewsArticleModel).where(NewsArticleModel.id == article_id)
        if lock:
            statement = statement.with_for_update()
        return await self._db.scalar(statement.execution_options(populate_existing=True))

    async def by_slug(self, slug: str) -> NewsArticleModel | None:
        return await self._db.scalar(select(NewsArticleModel).where(NewsArticleModel.slug == slug))

    async def find(
        self, q: str, section: str | None, tag: str | None, status: str | None, limit: int, offset: int
    ) -> tuple[list[NewsArticleModel], int]:
        conditions: list[Any] = []
        if status:
            conditions.append(NewsArticleModel.status == status)
        if q:
            conditions.append(
                or_(
                    NewsArticleModel.title.icontains(q, autoescape=True),
                    NewsArticleModel.summary.icontains(q, autoescape=True),
                )
            )
        if section:
            conditions.append(func.lower(NewsArticleModel.section) == section.lower())
        if tag:
            conditions.append(NewsArticleModel.hashtags.any(NewsHashtagModel.name == tag.lower()))
        total = await self._db.scalar(select(func.count()).select_from(NewsArticleModel).where(*conditions))
        rows = await self._db.scalars(
            select(NewsArticleModel)
            .where(*conditions)
            .order_by(
                NewsArticleModel.published_at.desc().nullslast(),
                NewsArticleModel.created_at.desc(),
                NewsArticleModel.id,
            )
            .offset(offset)
            .limit(limit)
        )
        return list(rows), total or 0

    async def tags(self) -> list[tuple[str, int]]:
        rows = await self._db.execute(
            select(NewsHashtagModel.name, func.count(NewsArticleModel.id))
            .join(NewsArticleModel.hashtags)
            .where(NewsArticleModel.status == "published")
            .group_by(NewsHashtagModel.name)
            .order_by(func.count(NewsArticleModel.id).desc(), NewsHashtagModel.name)
        )
        return [(name, count) for name, count in rows]

    async def hashtags(self, names: list[str]) -> list[NewsHashtagModel]:
        if not names:
            return []
        await self._db.execute(
            insert(NewsHashtagModel)
            .values([{"name": name} for name in names])
            .on_conflict_do_nothing(index_elements=["name"])
        )
        rows = await self._db.scalars(select(NewsHashtagModel).where(NewsHashtagModel.name.in_(names)))
        return list(rows)

    async def create(self, values: dict[str, Any]) -> NewsArticleModel:
        article = NewsArticleModel(**values)
        self._db.add(article)
        await self._db.flush()
        await self._db.refresh(article)
        return article

    async def add_view(self, article_id: UUID) -> None:
        await self._db.execute(
            update(NewsArticleModel)
            .where(NewsArticleModel.id == article_id)
            .values(views=NewsArticleModel.views + 1)
        )

    async def flush(self) -> None:
        await self._db.flush()
