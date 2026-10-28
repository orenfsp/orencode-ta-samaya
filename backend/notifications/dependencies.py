from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from applications.domain.applications import Applications
from applications.repositories.pg_application_members import ApplicationMemberRepository
from applications.repositories.pg_applications import ApplicationRepository
from audit.dependencies import get_audit
from auth.domain.roles import Roles
from auth.domain.sessions import Sessions
from auth.repositories.pg_user_roles import UserRoleRepository
from auth.repositories.pg_users import UserRepository
from auth.repositories.red_sessions import SessionRepository
from contests.repositories.pg_contests import ContestRepository
from core.config import settings
from core.database import DbSession, UnitOfWork, session_factory
from core.redis import RedisClient, redis_client
from dictionaries.domain.dictionaries import Dictionary
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from notifications.domain.bot_admins import BotAdmins
from notifications.domain.bot_dialog import BotDialog
from notifications.domain.notifications import Notifications
from notifications.domain.outbox_worker import OutboxWorker
from notifications.domain.telegram import Telegram
from notifications.domain.telegram_bot import TelegramBot
from notifications.repositories.pg_bot_admins import BotAdminRepository
from notifications.repositories.pg_bot_stats import BotStatsRepository
from notifications.repositories.pg_notification_settings import NotificationSettingRepository
from notifications.repositories.pg_notifications import NotificationRepository
from notifications.repositories.pg_outbox import OutboxRepository
from notifications.repositories.pg_telegram_links import TelegramLinkRepository
from notifications.repositories.red_telegram_state import TelegramStateRepository
from notifications.repositories.red_telegram_tokens import TelegramTokenRepository
from notifications.clients.smtp import SmtpClient
from notifications.clients.telegram import TelegramClient


def get_notifications(db: DbSession) -> Notifications:
    """Собирает домен уведомлений для FastAPI Depends."""
    return Notifications(NotificationRepository(db), OutboxRepository(db), UserRepository(db),
                         NotificationSettingRepository(db), TelegramLinkRepository(db), UnitOfWork(db), settings)


def get_telegram(db: DbSession, redis: RedisClient) -> Telegram:
    """Собирает домен привязки Telegram для FastAPI Depends."""
    return Telegram(TelegramLinkRepository(db), TelegramTokenRepository(redis), UserRepository(db), UnitOfWork(db),
                    settings)


def get_bot_admins(db: DbSession) -> BotAdmins:
    """Собирает домен администраторов бота для FastAPI Depends."""
    return BotAdmins(BotAdminRepository(db), UserRepository(db), UnitOfWork(db))


def bot_dialog(db: AsyncSession) -> BotDialog:
    """Собирает домен диалога Telegram-бота со всеми нужными ему сервисами."""
    uow = UnitOfWork(db)
    audit = get_audit(db)
    notifications = get_notifications(db)
    roles = Roles(uow=uow, users=UserRepository(db), user_roles=UserRoleRepository(db),
                  sessions=Sessions(SessionRepository(redis_client, settings.session_ttl_seconds)),
                  audit=audit, notifications=notifications)
    applications = Applications(uow=uow, applications=ApplicationRepository(db),
                                members=ApplicationMemberRepository(db), contests=ContestRepository(db),
                                dictionary=Dictionary(uow, DictionaryRepository(db), audit), audit=audit,
                                notifications=notifications)
    return BotDialog(get_telegram(db, redis_client), get_bot_admins(db), TelegramStateRepository(redis_client),
                     UserRepository(db), NotificationRepository(db), notifications, OutboxRepository(db),
                     BotStatsRepository(db), roles, applications, ContestRepository(db), uow, settings)


def telegram_api() -> TelegramClient | None:
    """Создаёт клиент Telegram Bot API, если в настройках задан токен."""
    token = settings.telegram_bot_token
    return TelegramClient(token.get_secret_value()) if token else None


def outbox_worker(api: TelegramClient | None) -> OutboxWorker:
    """Собирает воркер отправки исходящих уведомлений."""
    return OutboxWorker(session_factory, SmtpClient(settings), api, settings)


def telegram_bot(api: TelegramClient) -> TelegramBot:
    """Собирает обёртку опроса и обработки обновлений Telegram-бота."""
    return TelegramBot(session_factory, api, bot_dialog)


NotificationsDep = Annotated[Notifications, Depends(get_notifications)]
TelegramDep = Annotated[Telegram, Depends(get_telegram)]
BotAdminsDep = Annotated[BotAdmins, Depends(get_bot_admins)]
