import secrets
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request, Response, Security
from fastapi.security import APIKeyHeader

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from auth.domain.accounts import Account
from auth.domain.codes import Codes
from auth.repositories.pg_login_devices import LoginDeviceRepository
from auth.repositories.red_codes import CodeRepository
from auth.domain.password import password_hasher
from auth.domain.roles import Roles
from auth.domain.sessions import Sessions
from auth.repositories.pg_user_roles import UserRoleRepository
from auth.repositories.pg_users import UserRepository
from auth.repositories.red_forgot_requests import ForgotRequestRepository
from auth.repositories.red_login_attempts import LoginAttemptRepository
from auth.repositories.red_reset_tokens import ResetTokenRepository
from auth.repositories.red_sessions import SessionData, SessionRepository
from core.config import settings
from core.database import DbSession, UnitOfWork
from core.errors import CsrfFailed, Forbidden, Unauthorized
from core.redis import RedisClient
from infrastructure.enums import Role
from notifications.dependencies import NotificationsDep

@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: UUID
    email: str
    roles: frozenset[Role]
    sid: str
    granted: frozenset[Role] = frozenset()


SID_COOKIE = "sid"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

csrf_header = APIKeyHeader(
    name=CSRF_HEADER,
    auto_error=False,
    description="Значение куки csrf_token. Нужно для всех не-GET запросов с сессией.",
)
ACTIVE_ROLE_HEADER = "X-Active-Role"
active_role_header = APIKeyHeader(
    name=ACTIVE_ROLE_HEADER,
    auto_error=False,
    description="Активная роль кабинета: athlete, coach, judge, organizer, federation. Права запроса сужаются до неё.",
)


def get_sessions(redis: RedisClient) -> Sessions:
    """Собирает домен сессий поверх Redis-репозитория."""
    return Sessions(SessionRepository(redis, settings.session_ttl_seconds))


SessionsDep = Annotated[Sessions, Depends(get_sessions)]
AuditDep = Annotated[Audit, Depends(get_audit)]


def get_account(
    db: DbSession,
    redis: RedisClient,
    sessions: SessionsDep,
    audit: AuditDep,
    notifications: NotificationsDep,
) -> Account:
    """Собирает домен учётных записей со всеми его репозиториями."""
    return Account(
        uow=UnitOfWork(db),
        users=UserRepository(db),
        login_attempts=LoginAttemptRepository(redis),
        forgot_requests=ForgotRequestRepository(redis),
        reset_tokens=ResetTokenRepository(redis),
        sessions=sessions,
        audit=audit,
        hasher=password_hasher,
        settings=settings,
        notifications=notifications,
        codes=Codes(CodeRepository(redis), settings),
        devices=LoginDeviceRepository(db),
    )


def get_roles(db: DbSession, sessions: SessionsDep, audit: AuditDep, notifications: NotificationsDep) -> Roles:
    """Собирает домен ролей со всеми его репозиториями."""
    return Roles(
        uow=UnitOfWork(db),
        users=UserRepository(db),
        user_roles=UserRoleRepository(db),
        sessions=sessions,
        audit=audit,
        notifications=notifications,
    )


def set_auth_cookies(response: Response, session: SessionData) -> None:
    """Выставляет куки сессии и CSRF-токена в ответ."""
    common = {
        "max_age": settings.session_ttl_seconds,
        "samesite": "lax",
        "secure": settings.cookie_secure,
        "path": "/",
    }
    response.set_cookie(SID_COOKIE, session.sid, httponly=True, **common)
    response.set_cookie(CSRF_COOKIE, session.csrf, httponly=False, **common)


def clear_auth_cookies(response: Response) -> None:
    """Удаляет куки сессии и CSRF-токена из ответа."""
    response.delete_cookie(SID_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


async def optional_current_user(
    request: Request,
    response: Response,
    sessions: SessionsDep,
    csrf: Annotated[str | None, Security(csrf_header)],
    active: Annotated[str | None, Security(active_role_header)],
) -> CurrentUser | None:
    """Достаёт пользователя из сессии, проверяет CSRF и сужает права до активной роли кабинета; None, если сессии нет."""
    session = await sessions.resolve(request.cookies.get(SID_COOKIE))
    if session is None:
        return None
    if request.method not in SAFE_METHODS and not (csrf and secrets.compare_digest(csrf, session.csrf)):
        raise CsrfFailed()
    set_auth_cookies(response, session)
    roles = session.roles
    if active:
        if active not in {item.value for item in Role} or Role(active) not in session.roles:
            raise Forbidden("Эта роль не подтверждена у аккаунта")
        roles = frozenset({Role(active)})
    return CurrentUser(id=session.user_id, email=session.email, roles=roles, sid=session.sid, granted=session.roles)


async def current_user(user: Annotated[CurrentUser | None, Depends(optional_current_user)]) -> CurrentUser:
    """Требует авторизованного пользователя; иначе поднимает Unauthorized."""
    if user is None:
        raise Unauthorized()
    return user


def require_role(role: Role) -> Callable[..., Awaitable[CurrentUser]]:
    """Строит зависимость, требующую у пользователя указанную роль."""

    async def dependency(user: Annotated[CurrentUser, Depends(current_user)]) -> CurrentUser:
        """Проверяет, что у пользователя есть нужная роль; иначе поднимает Forbidden."""
        if role not in user.roles:
            raise Forbidden()
        return user

    return dependency


CurrentUserDep = Annotated[CurrentUser, Depends(current_user)]
OptionalUserDep = Annotated[CurrentUser | None, Depends(optional_current_user)]
AccountDep = Annotated[Account, Depends(get_account)]
RolesDep = Annotated[Roles, Depends(get_roles)]
