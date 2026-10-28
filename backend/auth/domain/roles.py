from datetime import UTC, datetime
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.domain.sessions import Sessions
from auth.repositories.pg_user_roles import RoleRequestQuery, UserRoleRepository
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import InvalidStatus, NotFound, RoleAlreadyRequested, SelfModeration, ValidationFailed
from infrastructure.enums import Role, RoleStatus
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType


class Roles:
    """Запрос, модерация и синхронизация ролей пользователя с сессией."""

    SELF_REGISTER_ROLES = frozenset({Role.ATHLETE, Role.COACH, Role.JUDGE, Role.ORGANIZER, Role.FEDERATION})
    AUTO_VERIFIED_ROLES = frozenset({Role.ATHLETE})
    OPEN_ACCESS_ROLES = frozenset({Role.ATHLETE, Role.COACH})
    MODERATED_ROLES = frozenset({Role.COACH, Role.JUDGE, Role.ORGANIZER, Role.FEDERATION})

    def __init__(
        self,
        uow: UnitOfWork,
        users: UserRepository,
        user_roles: UserRoleRepository,
        sessions: Sessions,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._users = users
        self._user_roles = user_roles
        self._sessions = sessions
        self._audit = audit
        self._notifications = notifications

    @classmethod
    def initial_status(cls, role: Role) -> RoleStatus:
        """Статус роли сразу после запроса: верифицирован для автороли, иначе ожидание."""
        return RoleStatus.VERIFIED if role in cls.AUTO_VERIFIED_ROLES else RoleStatus.PENDING

    @classmethod
    def grants_access(cls, role: Role, status: RoleStatus) -> bool:
        """True, если роль с этим статусом даёт доступ в систему."""
        return status == RoleStatus.VERIFIED or role in cls.OPEN_ACCESS_ROLES

    @classmethod
    def granted_roles(cls, user: UserModel) -> frozenset[Role]:
        """Роли пользователя, дающие доступ прямо сейчас."""
        return frozenset(item.role for item in user.roles if cls.grants_access(item.role, item.status))

    async def request(self, user_id: UUID, role: Role, ip: str | None) -> UserModel:
        """Запрашивает роль для пользователя, переоткрывая отклонённую заявку; уведомляет модераторов при нужде."""
        if role not in self.SELF_REGISTER_ROLES:
            raise ValidationFailed(fields={"role": ["Эту роль нельзя запросить"]})
        now = datetime.now(UTC)
        existing = await self._user_roles.find(user_id, role)
        if existing is None:
            await self._user_roles.add(user_id, role, self.initial_status(role), now)
        elif existing.status == RoleStatus.REJECTED:
            await self._user_roles.reopen(existing.id, now)
        else:
            raise RoleAlreadyRequested()
        await self._audit.write(
            AuditAction.ROLE_REQUEST,
            user_id=user_id,
            object_type="user_role",
            payload={"role": role.value},
            ip=ip,
        )
        if role in self.MODERATED_ROLES:
            await self._notifications.role_requested(user_id, role)
        await self._uow.commit()
        return await self._sync_sessions(user_id)

    async def complete_onboarding(self, user_id: UUID, role: Role) -> None:
        """Отмечает прохождение онбординга для роли; NotFound, если заявки нет."""
        if not await self._user_roles.mark_onboarding(user_id, role):
            raise NotFound()
        await self._uow.commit()

    async def list_requests(
        self,
        statuses: frozenset[RoleStatus],
        role: Role | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[UserRoleModel], int]:
        """Список заявок на модерируемые роли по фильтрам с общим количеством."""
        if role is not None and role not in self.MODERATED_ROLES:
            raise ValidationFailed(fields={"role": ["Эта роль не проходит модерацию"]})
        query = RoleRequestQuery(
            statuses=statuses,
            roles=frozenset({role}) if role else self.MODERATED_ROLES,
            search=search,
        )
        return await self._user_roles.list_requests(query, limit, offset)

    async def count_pending(self) -> dict[Role, int]:
        """Количество заявок в ожидании по каждой модерируемой роли."""
        return await self._user_roles.count_by_role(RoleStatus.PENDING, self.MODERATED_ROLES)

    async def approve(self, decided_by: UUID, role_id: UUID, ip: str | None) -> UserRoleModel:
        """Одобряет заявку на роль."""
        return await self._decide(decided_by, role_id, RoleStatus.VERIFIED, None, AuditAction.ROLE_APPROVE, ip)

    async def reject(self, decided_by: UUID, role_id: UUID, reason: str, ip: str | None) -> UserRoleModel:
        """Отклоняет заявку на роль с указанием причины."""
        return await self._decide(decided_by, role_id, RoleStatus.REJECTED, reason, AuditAction.ROLE_REJECT, ip)

    async def reset(self, decided_by: UUID, role_id: UUID, reason: str | None, ip: str | None) -> UserRoleModel:
        """Возвращает решённую заявку на роль в состояние ожидания."""
        locked = await self._lock_foreign(decided_by, role_id)
        if locked.status == RoleStatus.PENDING:
            await self._uow.rollback()
            raise InvalidStatus()
        user_id, role, previous = locked.user_id, locked.role, locked.status
        await self._user_roles.reset(role_id)
        payload = {"user_id": str(user_id), "role": role.value, "previous": previous.value}
        if reason:
            payload["reason"] = reason
        await self._audit.write(
            AuditAction.ROLE_RESET, user_id=decided_by, object_type="user_role", object_id=role_id, payload=payload, ip=ip
        )
        await self._notifications.role_decided(user_id, decided_by, role, NotificationType.ROLE_RESET, reason)
        await self._uow.commit()
        return await self._after_change(user_id, role_id)

    async def _lock_foreign(self, decided_by: UUID, role_id: UUID) -> UserRoleModel:
        """Блокирует заявку на модерируемую роль чужого пользователя; проверяет, что это не самомодерация."""
        locked = await self._user_roles.lock(role_id)
        if locked is None or locked.role not in self.MODERATED_ROLES:
            await self._uow.rollback()
            raise NotFound()
        if locked.user_id == decided_by:
            await self._uow.rollback()
            raise SelfModeration()
        return locked

    async def _decide(
        self,
        decided_by: UUID,
        role_id: UUID,
        status: RoleStatus,
        reason: str | None,
        action: AuditAction,
        ip: str | None,
    ) -> UserRoleModel:
        """Переводит заявку в ожидании в указанный статус, пишет аудит и уведомляет пользователя."""
        locked = await self._lock_foreign(decided_by, role_id)
        if locked.status != RoleStatus.PENDING:
            await self._uow.rollback()
            raise InvalidStatus()
        user_id, role = locked.user_id, locked.role
        await self._user_roles.decide(role_id, status, reason, decided_by, datetime.now(UTC))
        payload = {"user_id": str(user_id), "role": role.value}
        if reason:
            payload["reason"] = reason
        await self._audit.write(
            action, user_id=decided_by, object_type="user_role", object_id=role_id, payload=payload, ip=ip
        )
        kind = NotificationType.ROLE_APPROVED if status == RoleStatus.VERIFIED else NotificationType.ROLE_REJECTED
        await self._notifications.role_decided(user_id, decided_by, role, kind, reason)
        await self._uow.commit()
        return await self._after_change(user_id, role_id)

    async def _after_change(self, user_id: UUID, role_id: UUID) -> UserRoleModel:
        """Синхронизирует сессию и возвращает актуальную заявку после изменения её статуса."""
        await self._sync_sessions(user_id)
        request = await self._user_roles.get_request(role_id)
        if request is None:
            raise NotFound()
        return request

    async def _sync_sessions(self, user_id: UUID) -> UserModel:
        """Обновляет роли в сессиях пользователя по текущему состоянию из базы."""
        user = await self._users.get(user_id)
        if user is None:
            raise NotFound()
        await self._sessions.refresh_roles(user.id, self.granted_roles(user))
        return user
