import asyncio
import logging

import infrastructure.audit_log
import infrastructure.calendar_event
import infrastructure.news_article
import infrastructure.news_article_hashtag
import infrastructure.news_hashtag
import infrastructure.contest
import infrastructure.contest_application
import infrastructure.contest_application_member
import infrastructure.contest_photo
import infrastructure.file
import infrastructure.contest_status_history
import infrastructure.user
import infrastructure.user_role
import dictionaries.domain.dictionaries
from core.config import settings
from core.database import engine, session_factory
from demo import seed_demo
from demo_dictionaries import seed as seed_dictionaries
from demo_calendar import seed as seed_calendar
from demo_contests import seed as seed_contests
from demo_applications import seed as seed_applications
from demo_news import seed as seed_news
from files.repositories.s3_files import ObjectRepository
from infrastructure.base import Base

logger = logging.getLogger("fsp.bootstrap")


async def bootstrap() -> None:
    await ObjectRepository(settings).ensure_buckets()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with session_factory() as session:
        await seed_demo(session)
        await seed_dictionaries(session)
        await seed_calendar(session)
        await seed_contests(session)
        await seed_applications(session)
        await seed_news(session)
    await engine.dispose()
    logger.info("Schema created, demo data seeded")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(bootstrap())
