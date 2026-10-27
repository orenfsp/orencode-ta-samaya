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

@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: UUID
    email: str
    roles: frozenset[Role]
    sid: str


SID_COOKIE = "sid"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

csrf_header = APIKeyHeader(
    name=CSRF_HEADER,
    auto_error=False,
    description="Значение куки csrf_token. Нужно для всех не-GET запросов с сессией.",
)


def get_sessions(redis: RedisClient) -> Sessions:
    return Sessions(SessionRepository(redis, settings.session_ttl_seconds))


SessionsDep = Annotated[Sessions, Depends(get_sessions)]
AuditDep = Annotated[Audit, Depends(get_audit)]


def get_account(
    db: DbSession,
    redis: RedisClient,
    sessions: SessionsDep,
    audit: AuditDep,
) -> Account:
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
    )


def get_roles(db: DbSession, sessions: SessionsDep, audit: AuditDep) -> Roles:
    return Roles(
        uow=UnitOfWork(db),
        users=UserRepository(db),
        user_roles=UserRoleRepository(db),
        sessions=sessions,
        audit=audit,
    )


def set_auth_cookies(response: Response, session: SessionData) -> None:
    common = {
        "max_age": settings.session_ttl_seconds,
        "samesite": "lax",
        "secure": settings.cookie_secure,
        "path": "/",
    }
    response.set_cookie(SID_COOKIE, session.sid, httponly=True, **common)
    response.set_cookie(CSRF_COOKIE, session.csrf, httponly=False, **common)


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(SID_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


async def optional_current_user(
    request: Request,
    response: Response,
    sessions: SessionsDep,
    csrf: Annotated[str | None, Security(csrf_header)],
) -> CurrentUser | None:
    session = await sessions.resolve(request.cookies.get(SID_COOKIE))
    if session is None:
        return None
    if request.method not in SAFE_METHODS and not (csrf and secrets.compare_digest(csrf, session.csrf)):
        raise CsrfFailed()
    set_auth_cookies(response, session)
    return CurrentUser(id=session.user_id, email=session.email, roles=session.roles, sid=session.sid)


async def current_user(user: Annotated[CurrentUser | None, Depends(optional_current_user)]) -> CurrentUser:
    if user is None:
        raise Unauthorized()
    return user


def require_role(role: Role) -> Callable[..., Awaitable[CurrentUser]]:
    async def dependency(user: Annotated[CurrentUser, Depends(current_user)]) -> CurrentUser:
        if role not in user.roles:
            raise Forbidden()
        return user

    return dependency


CurrentUserDep = Annotated[CurrentUser, Depends(current_user)]
OptionalUserDep = Annotated[CurrentUser | None, Depends(optional_current_user)]
AccountDep = Annotated[Account, Depends(get_account)]
RolesDep = Annotated[Roles, Depends(get_roles)]
