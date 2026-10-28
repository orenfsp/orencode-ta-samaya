from typing import Any
from uuid import UUID

from sqlalchemy import exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.content.news_article import NewsArticleModel


class NewsRepository:
    """Доступ к статьям новостей в Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, article_id: UUID, lock: bool = False) -> NewsArticleModel | None:
        """Возвращает статью по id, опционально с блокировкой строки для изменения."""
        statement = select(NewsArticleModel).where(NewsArticleModel.id == article_id)
        if lock:
            statement = statement.with_for_update()
        return await self._db.scalar(statement.execution_options(populate_existing=True))

    async def slug_taken(self, slug: str) -> bool:
        """Проверяет, занят ли такой slug другой статьёй."""
        return bool(await self._db.scalar(select(exists().where(NewsArticleModel.slug == slug))))

    async def by_slug(self, slug: str) -> NewsArticleModel | None:
        """Возвращает статью по её slug."""
        return await self._db.scalar(select(NewsArticleModel).where(NewsArticleModel.slug == slug))

    async def find(
        self, q: str, section: str | None, tag: str | None, status: str | None, limit: int, offset: int
    ) -> tuple[list[NewsArticleModel], int]:
        """Возвращает страницу статей по фильтрам и их общее количество."""
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
            conditions.append(NewsArticleModel.hashtags.contains([tag.lower()]))
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
        """Возвращает хэштеги опубликованных статей с количеством упоминаний."""
        tags = (
            select(func.unnest(NewsArticleModel.hashtags).label("name"))
            .where(NewsArticleModel.status == "published")
            .subquery()
        )
        rows = await self._db.execute(
            select(tags.c.name, func.count()).group_by(tags.c.name).order_by(func.count().desc(), tags.c.name)
        )
        return [(name, count) for name, count in rows]

    async def create(self, values: dict[str, Any]) -> NewsArticleModel:
        """Создаёт новую статью с переданными полями."""
        article = NewsArticleModel(**values)
        self._db.add(article)
        await self._db.flush()
        await self._db.refresh(article)
        return article

    async def add_view(self, article_id: UUID) -> None:
        """Увеличивает счётчик просмотров статьи на единицу."""
        await self._db.execute(
            update(NewsArticleModel)
            .where(NewsArticleModel.id == article_id)
            .values(views=NewsArticleModel.views + 1)
        )

    async def flush(self) -> None:
        """Сбрасывает текущие изменения сессии в БД без коммита."""
        await self._db.flush()
