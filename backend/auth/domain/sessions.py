import secrets
from datetime import UTC, datetime
from uuid import UUID

from auth.repositories.red_sessions import SessionData, SessionRepository
from infrastructure.enums import Role


class Sessions:
    def __init__(self, sessions: SessionRepository) -> None:
        self._sessions = sessions

    async def open(self, user_id: UUID, email: str, roles: frozenset[Role]) -> SessionData:
        session = SessionData(
            sid=secrets.token_urlsafe(32),
            user_id=user_id,
            email=email,
            roles=roles,
            csrf=secrets.token_urlsafe(32),
            created_at=datetime.now(UTC),
        )
        await self._sessions.save(session)
        return session

    async def close_if_exists(self, sid: str | None) -> None:
        if not sid:
            return
        session = await self._sessions.get(sid)
        if session is not None:
            await self._sessions.delete(session.sid, session.user_id)

    async def resolve(self, sid: str | None) -> SessionData | None:
        if not sid:
            return None
        session = await self._sessions.get(sid)
        if session is not None:
            await self._sessions.touch(session)
        return session

    async def close(self, sid: str, user_id: UUID) -> None:
        await self._sessions.delete(sid, user_id)

    async def close_all(self, user_id: UUID) -> None:
        await self._sessions.delete_all(user_id)

    async def refresh_roles(self, user_id: UUID, roles: frozenset[Role]) -> None:
        await self._sessions.set_roles(user_id, roles)
