from typing import Annotated

from fastapi import Depends

from auth.dependencies import AuditDep
from core.database import DbSession, UnitOfWork
from core.redis import RedisClient
from files.dependencies import FilesDep
from news.domain.news import News
from news.repositories.pg_news import NewsRepository
from news.repositories.red_news_views import NewsViewsRepository


def get_news(db: DbSession, redis: RedisClient, files: FilesDep, audit: AuditDep) -> News:
    return News(NewsRepository(db), NewsViewsRepository(redis), files, UnitOfWork(db), audit)


NewsDep = Annotated[News, Depends(get_news)]
