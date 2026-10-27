import hashlib
import logging
import secrets
from datetime import UTC, date, datetime
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.domain.password import PasswordHasher
from auth.domain.roles import Roles
from auth.domain.sessions import Sessions
from auth.repositories.pg_users import UserRepository
from auth.repositories.red_forgot_requests import ForgotRequestRepository
from auth.repositories.red_login_attempts import LoginAttemptRepository
from auth.repositories.red_reset_tokens import ResetTokenRepository
from auth.repositories.red_sessions import SessionData
from core.config import Settings
from core.database import UnitOfWork
from core.errors import (
    AccountDisabled,
    EmailTaken,
    InvalidCredentials,
    InvalidToken,
    NotFound,
    TooManyAttempts,
    Unauthorized,
    ValidationFailed,
)
from infrastructure.enums import Role
from infrastructure.user import UserModel

logger = logging.getLogger("fsp.auth")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class Account:
    def __init__(
        self,
        uow: UnitOfWork,
        users: UserRepository,
        login_attempts: LoginAttemptRepository,
        forgot_requests: ForgotRequestRepository,
        reset_tokens: ResetTokenRepository,
        sessions: Sessions,
        audit: Audit,
        hasher: PasswordHasher,
        settings: Settings,
    ) -> None:
        self._uow = uow
        self._users = users
        self._login_attempts = login_attempts
        self._forgot_requests = forgot_requests
        self._reset_tokens = reset_tokens
        self._sessions = sessions
        self._audit = audit
        self._hasher = hasher
        self._settings = settings

    async def register(
        self,
        email: str,
        password: str,
        last_name: str,
        first_name: str,
        middle_name: str | None,
        birth_date: date,
        roles: list[Role],
        ip: str | None,
    ) -> UserModel:
        if await self._users.email_exists(email):
            raise EmailTaken(fields={"email": [EmailTaken.message]})
        now = datetime.now(UTC)
        user = await self._users.create(
            email=email,
            password_hash=await self._hasher.hash(password),
            last_name=last_name,
            first_name=first_name,
            middle_name=middle_name,
            birth_date=birth_date,
            pd_consent_version=self._settings.pd_consent_version,
            pd_consent_at=now,
            roles=[(role, Roles.initial_status(role)) for role in roles],
        )
        await self._audit.write(
            AuditAction.AUTH_REGISTER,
            user_id=user.id,
            object_type="user",
            object_id=user.id,
            payload={"roles": [role.value for role in roles]},
            ip=ip,
        )
        await self._uow.commit()
        return user

    async def authenticate(self, email: str, password: str, ip: str | None) -> UserModel:
        if await self._login_attempts.failures(ip, email) >= self._settings.login_max_attempts:
            retry_after = await self._login_attempts.retry_after(ip, email)
            raise TooManyAttempts(headers={"Retry-After": str(retry_after)})

        user = await self._users.get_by_email(email)
        password_ok = await self._hasher.verify(user.password_hash if user else None, password)
        if user is None or not password_ok:
            await self._login_attempts.register_failure(ip, email, self._settings.login_window_seconds)
            await self._audit.write(
                AuditAction.AUTH_LOGIN_FAILED,
                user_id=user.id if user else None,
                payload={"email": email},
                ip=ip,
            )
            await self._uow.commit()
            raise InvalidCredentials()

        if not user.is_active:
            raise AccountDisabled()

        await self._login_attempts.reset(ip, email)
        if self._hasher.needs_rehash(user.password_hash):
            await self._users.set_password_hash(user.id, await self._hasher.hash(password))
        await self._users.set_last_login(user.id, datetime.now(UTC))
        await self._audit.write(AuditAction.AUTH_LOGIN, user_id=user.id, ip=ip)
        await self._uow.commit()
        return user

    async def start_session(self, old_sid: str | None, user: UserModel) -> SessionData:
        await self._sessions.close_if_exists(old_sid)
        return await self._sessions.open(user.id, user.email, Roles.granted_roles(user))

    async def get_me(self, user_id: UUID, session_roles: frozenset[Role]) -> UserModel:
        user = await self._users.get(user_id)
        if user is None or not user.is_active:
            await self._sessions.close_all(user_id)
            raise Unauthorized()
        roles = Roles.granted_roles(user)
        if roles != session_roles:
            await self._sessions.refresh_roles(user.id, roles)
        return user

    async def update_profile(self, user_id: UUID, academic_group_id: int | None, ip: str | None) -> UserModel:
        user = await self.get_user(user_id)
        if academic_group_id is not None and not await self._users.academic_group_exists(academic_group_id):
            raise ValidationFailed(fields={"academic_group_id": ["Выберите значение из справочника"]})
        old = user.academic_group_id
        await self._users.set_academic_group(user_id, academic_group_id)
        await self._audit.write(
            AuditAction.PROFILE_UPDATE,
            user_id=user_id,
            object_type="user",
            object_id=user_id,
            payload={"academic_group_id": {"old": old, "new": academic_group_id}},
            ip=ip,
        )
        await self._uow.commit()
        return await self.get_user(user_id)

    async def get_user(self, user_id: UUID) -> UserModel:
        user = await self._users.get(user_id)
        if user is None:
            raise NotFound()
        return user

    async def logout(self, sid: str, user_id: UUID, ip: str | None) -> None:
        await self._sessions.close(sid, user_id)
        await self._audit.write(AuditAction.AUTH_LOGOUT, user_id=user_id, ip=ip)
        await self._uow.commit()

    async def forgot_password(self, email: str, ip: str | None) -> None:
        requests = await self._forgot_requests.hit(email, self._settings.forgot_window_seconds)
        if requests > self._settings.forgot_max_requests:
            return
        user = await self._users.get_by_email(email)
        if user is None or not user.is_active:
            return
        token = secrets.token_urlsafe(32)
        await self._reset_tokens.save(_token_hash(token), user.id, self._settings.reset_token_ttl_seconds)
        logger.info(
            "Password reset link for %s: %s/reset-password?token=%s",
            email,
            self._settings.frontend_url,
            token,
        )
        await self._audit.write(AuditAction.AUTH_PASSWORD_RESET_REQUESTED, user_id=user.id, ip=ip)
        await self._uow.commit()

    async def reset_password(self, token: str, password: str, ip: str | None) -> None:
        user_id = await self._reset_tokens.pop(_token_hash(token))
        if user_id is None:
            raise InvalidToken()
        user = await self._users.get(user_id)
        if user is None or not user.is_active:
            raise InvalidToken()
        await self._users.set_password_hash(user.id, await self._hasher.hash(password))
        await self._audit.write(AuditAction.AUTH_PASSWORD_RESET, user_id=user.id, ip=ip)
        await self._uow.commit()
        await self._sessions.close_all(user.id)
        await self._login_attempts.reset_email(user.email)
