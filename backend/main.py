import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI

import infrastructure.audit_log
import infrastructure.calendar_event
import infrastructure.news_article
import infrastructure.news_article_hashtag
import infrastructure.news_hashtag
import infrastructure.contest_application
import infrastructure.user
import infrastructure.user_role
from applications.features import router as applications_router
from auth.features import router as auth_router
from contests.features import router as contests_router
from dictionaries.features import router as dictionaries_router
from files.features import router as files_router
from core.database import engine
from core.errors import register_error_handlers
from core.health import router as health_router
from core.redis import redis_client
from events.features import router as calendar_router
from news.features import router as news_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await redis_client.aclose()
    await engine.dispose()


app = FastAPI(title="ФСП Оренбургской области", version="0.1.0", lifespan=lifespan)
register_error_handlers(app)

api = APIRouter(prefix="/api/v1")
api.include_router(health_router)
api.include_router(auth_router)
api.include_router(dictionaries_router)
api.include_router(contests_router)
api.include_router(applications_router)
api.include_router(files_router)
api.include_router(news_router)
api.include_router(calendar_router)
app.include_router(api)
