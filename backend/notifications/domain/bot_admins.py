from collections.abc import Sequence
from uuid import UUID

from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import Forbidden, InvalidStatus, NotFound, ValidationFailed
from infrastructure.notifications.bot_admin import BotAdminModel
from infrastructure.enums import BotAdminLevel, Role, RoleStatus
from notifications.repositories.pg_bot_admins import BotAdminRepository

L = BotAdminLevel


class BotAdmins:
    """Администраторы Telegram-бота: уровни, права и их назначение."""

    LEVEL_LABELS = {L.MODERATOR: "Модератор", L.ADMIN: "Администратор", L.OWNER: "Владелец"}
    RIGHT_LABELS = {
        "queue": "Очередь модерации: заявки на роли, соревнования на верификации",
        "decide": "Подтверждать и отклонять заявки на роли прямо в боте",
        "stats": "Статистика платформы",
        "broadcast": "Рассылка всем, кто привязал Telegram",
        "admins": "Назначать и снимать администраторов бота",
    }
    RIGHTS: dict[BotAdminLevel, tuple[str, ...]] = {
        L.MODERATOR: ("queue", "decide"),
        L.ADMIN: ("queue", "decide", "stats", "broadcast"),
        L.OWNER: ("queue", "decide", "stats", "broadcast", "admins"),
    }

    def __init__(self, admins: BotAdminRepository, users: UserRepository, uow: UnitOfWork) -> None:
        """Сохраняет зависимости."""
        self._admins, self._users, self._uow = admins, users, uow

    async def level(self, user_id: UUID) -> BotAdminLevel | None:
        """Возвращает уровень администратора бота у пользователя или None."""
        return await self._admins.level(user_id)

    async def can(self, user_id: UUID, right: str) -> bool:
        """Проверяет, даёт ли уровень пользователя указанное право."""
        level = await self._admins.level(user_id)
        return level is not None and right in self.RIGHTS[level]

    async def list(self) -> Sequence[BotAdminModel]:
        """Возвращает всех администраторов бота."""
        return await self._admins.all()

    async def grant(self, actor_id: UUID, email: str, level: BotAdminLevel) -> None:
        """Назначает администратором бота верифицированного сотрудника федерации по email."""
        await self._owner(actor_id)
        user = await self._users.get_by_email(email.strip().lower())
        if user is None or not user.is_active:
            raise ValidationFailed(fields={"email": ["Пользователь с такой почтой не найден"]})
        if not any(item.role == Role.FEDERATION and item.status == RoleStatus.VERIFIED for item in user.roles):
            raise ValidationFailed(fields={"email": ["Администратором бота может быть только сотрудник федерации"]})
        if await self._admins.level(user.id) is not None:
            raise ValidationFailed(fields={"email": ["Уже администратор бота"]})
        await self._admins.add(user.id, level, actor_id)
        await self._uow.commit()

    async def change(self, actor_id: UUID, user_id: UUID, level: BotAdminLevel) -> None:
        """Меняет уровень администратора; не даёт понизить последнего владельца."""
        await self._owner(actor_id)
        current = await self._admins.level(user_id)
        if current is None:
            raise NotFound()
        if current == L.OWNER and level != L.OWNER and await self._admins.owners() <= 1:
            raise InvalidStatus("Нельзя понизить последнего владельца")
        await self._admins.set_level(user_id, level)
        await self._uow.commit()

    async def revoke(self, actor_id: UUID, user_id: UUID) -> None:
        """Снимает администратора бота; не даёт снять последнего владельца."""
        await self._owner(actor_id)
        current = await self._admins.level(user_id)
        if current is None:
            raise NotFound()
        if current == L.OWNER and await self._admins.owners() <= 1:
            raise InvalidStatus("Нельзя снять последнего владельца")
        await self._admins.remove(user_id)
        await self._uow.commit()

    async def _owner(self, actor_id: UUID) -> None:
        """Проверяет, что действие совершает владелец бота; иначе 403."""
        if await self._admins.level(actor_id) != L.OWNER:
            raise Forbidden("Назначать администраторов бота может только владелец")
