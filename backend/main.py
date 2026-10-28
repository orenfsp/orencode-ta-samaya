import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import APIRouter, FastAPI

import infrastructure.services.audit_log
import infrastructure.notifications.bot_admin
import infrastructure.content.calendar_event
import infrastructure.participation.contest_application
import infrastructure.account.login_device
import infrastructure.participation.contest_result
import infrastructure.participation.document
import infrastructure.account.guardian_consent
import infrastructure.content.news_article
import infrastructure.notifications.notification
import infrastructure.notifications.notification_setting
import infrastructure.notifications.outbox
import infrastructure.notifications.telegram_link
import infrastructure.account.user
import infrastructure.account.user_role
import infrastructure.account.wall_post
import infrastructure.qualifications.qualification
import infrastructure.qualifications.judge_assignment
import infrastructure.qualifications.judge_document
import infrastructure.qualifications.deadline_notice
import infrastructure.squads.squad
from applications.features import router as applications_router
from analytics.features import router as analytics_router
from audit.features import router as audit_router
from documents.features import router as documents_router
from auth.features import router as auth_router
from consents.features import router as consents_router
from contests.features import router as contests_router
from core.config import settings
from core.database import engine
from core.errors import register_error_handlers
from core.health import router as health_router
from core.redis import redis_client
from dictionaries.features import router as dictionaries_router
from events.features import router as events_router
from files.features import router as files_router
from news.features import router as news_router
from notifications.dependencies import outbox_worker, telegram_api, telegram_bot
from notifications.features import router as notifications_router
from ratings.features import router as ratings_router
from results.features import router as results_router
from people.dependencies import codeforces_watcher
from people.features import router as people_router
from qualifications.dependencies import deadline_watcher
from qualifications.features import router as qualifications_router
from reports.features import router as reports_router
from squads.features import router as squads_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Запускает фоновые воркеры (outbox, дедлайны, Codeforces, Telegram) и останавливает их при завершении."""
    telegram = telegram_api()
    tasks = [asyncio.create_task(outbox_worker(telegram).run())] if settings.mail_worker_enabled else []
    tasks.append(asyncio.create_task(deadline_watcher().run()))
    if settings.codeforces_enabled:
        tasks.append(asyncio.create_task(codeforces_watcher().run()))
    if telegram:
        tasks.append(asyncio.create_task(telegram_bot(telegram).run()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        if telegram:
            await telegram.close()
        await redis_client.aclose()
        await engine.dispose()


app = FastAPI(title="ФСП Оренбургской области", version="0.1.0", lifespan=lifespan)
register_error_handlers(app)

api = APIRouter(prefix="/api/v1")
api.include_router(health_router)
api.include_router(auth_router)
api.include_router(audit_router)
api.include_router(notifications_router)
api.include_router(dictionaries_router)
api.include_router(contests_router)
api.include_router(applications_router)
api.include_router(files_router)
api.include_router(news_router)
api.include_router(events_router)
api.include_router(results_router)
api.include_router(ratings_router)
api.include_router(documents_router)
api.include_router(people_router)
api.include_router(qualifications_router)
api.include_router(reports_router)
api.include_router(consents_router)
api.include_router(analytics_router)
api.include_router(squads_router)
app.include_router(api)
