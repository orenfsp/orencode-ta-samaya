from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.enums import ApplicationStatus, RoleStatus, VerificationStatus
from infrastructure.notifications.telegram_link import TelegramLinkModel
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel


class BotStatsRepository:
    """Сводная статистика платформы для панели бота."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def counts(self) -> dict[str, int]:
        """Возвращает счётчики пользователей, заявок и очередей модерации."""
        async def count(statement) -> int:
            """Возвращает число строк по переданному statement, 0 вместо None."""
            return await self._db.scalar(statement) or 0

        return {
            "users": await count(select(func.count()).select_from(UserModel).where(UserModel.is_active.is_(True))),
            "verified": await count(select(func.count()).select_from(UserModel)
                                    .where(UserModel.email_verified_at.is_not(None))),
            "telegram": await count(select(func.count()).select_from(TelegramLinkModel)),
            "roles": await count(select(func.count()).select_from(UserRoleModel)
                                 .where(UserRoleModel.status == RoleStatus.PENDING)),
            "applications": await count(select(func.count()).select_from(ContestApplicationModel)
                                        .where(ContestApplicationModel.status == ApplicationStatus.SUBMITTED)),
            "verification": await count(select(func.count()).select_from(ContestModel)
                                        .where(ContestModel.verification_status == VerificationStatus.PENDING)),
        }

    async def chats(self) -> list[tuple[int, object]]:
        """Возвращает все пары (chat_id, user_id) привязанных Telegram-чатов для рассылки."""
        rows = await self._db.execute(select(TelegramLinkModel.chat_id, TelegramLinkModel.user_id))
        return [(chat_id, user_id) for chat_id, user_id in rows]
