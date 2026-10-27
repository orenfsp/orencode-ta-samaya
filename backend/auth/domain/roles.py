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
from infrastructure.user import UserModel
from infrastructure.user_role import UserRoleModel


class Roles:
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
    ) -> None:
        self._uow = uow
        self._users = users
        self._user_roles = user_roles
        self._sessions = sessions
        self._audit = audit

    @classmethod
    def initial_status(cls, role: Role) -> RoleStatus:
        return RoleStatus.VERIFIED if role in cls.AUTO_VERIFIED_ROLES else RoleStatus.PENDING

    @classmethod
    def grants_access(cls, role: Role, status: RoleStatus) -> bool:
        return status == RoleStatus.VERIFIED or role in cls.OPEN_ACCESS_ROLES

    @classmethod
    def granted_roles(cls, user: UserModel) -> frozenset[Role]:
        return frozenset(item.role for item in user.roles if cls.grants_access(item.role, item.status))

    async def request(self, user_id: UUID, role: Role, ip: str | None) -> UserModel:
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
        await self._uow.commit()
        return await self._sync_sessions(user_id)

    async def complete_onboarding(self, user_id: UUID, role: Role) -> None:
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
        if role is not None and role not in self.MODERATED_ROLES:
            raise ValidationFailed(fields={"role": ["Эта роль не проходит модерацию"]})
        query = RoleRequestQuery(
            statuses=statuses,
            roles=frozenset({role}) if role else self.MODERATED_ROLES,
            search=search,
        )
        return await self._user_roles.list_requests(query, limit, offset)

    async def count_pending(self) -> dict[Role, int]:
        return await self._user_roles.count_by_role(RoleStatus.PENDING, self.MODERATED_ROLES)

    async def approve(self, decided_by: UUID, role_id: UUID, ip: str | None) -> UserRoleModel:
        return await self._decide(decided_by, role_id, RoleStatus.VERIFIED, None, AuditAction.ROLE_APPROVE, ip)

    async def reject(self, decided_by: UUID, role_id: UUID, reason: str, ip: str | None) -> UserRoleModel:
        return await self._decide(decided_by, role_id, RoleStatus.REJECTED, reason, AuditAction.ROLE_REJECT, ip)

    async def reset(self, decided_by: UUID, role_id: UUID, reason: str | None, ip: str | None) -> UserRoleModel:
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
        await self._uow.commit()
        return await self._after_change(user_id, role_id)

    async def _lock_foreign(self, decided_by: UUID, role_id: UUID) -> UserRoleModel:
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
        await self._uow.commit()
        return await self._after_change(user_id, role_id)

    async def _after_change(self, user_id: UUID, role_id: UUID) -> UserRoleModel:
        await self._sync_sessions(user_id)
        request = await self._user_roles.get_request(role_id)
        if request is None:
            raise NotFound()
        return request

    async def _sync_sessions(self, user_id: UUID) -> UserModel:
        user = await self._users.get(user_id)
        if user is None:
            raise NotFound()
        await self._sessions.refresh_roles(user.id, self.granted_roles(user))
        return user
