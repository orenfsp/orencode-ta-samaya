import json
from collections.abc import Awaitable
from dataclasses import dataclass, replace
from datetime import datetime
from typing import cast
from uuid import UUID

from redis.asyncio import Redis

from infrastructure.enums import Role


@dataclass(frozen=True, slots=True)
class SessionData:
    sid: str
    user_id: UUID
    email: str
    roles: frozenset[Role]
    csrf: str
    created_at: datetime


def _session_key(sid: str) -> str:
    """Строит ключ Redis для сессии по sid."""
    return f"session:{sid}"


def _user_key(user_id: UUID) -> str:
    """Строит ключ Redis для набора sid сессий пользователя."""
    return f"user_sessions:{user_id}"


def _dump(session: SessionData) -> str:
    """Сериализует сессию в JSON для хранения в Redis."""
    return json.dumps(
        {
            "user_id": str(session.user_id),
            "email": session.email,
            "roles": sorted(session.roles),
            "csrf": session.csrf,
            "created_at": session.created_at.isoformat(),
        }
    )


def _load(sid: str, raw: str) -> SessionData:
    """Восстанавливает сессию из JSON, сохранённого в Redis."""
    data = json.loads(raw)
    return SessionData(
        sid=sid,
        user_id=UUID(data["user_id"]),
        email=data["email"],
        roles=frozenset(Role(item) for item in data["roles"]),
        csrf=data["csrf"],
        created_at=datetime.fromisoformat(data["created_at"]),
    )


class SessionRepository:
    def __init__(self, redis: Redis, ttl_seconds: int) -> None:
        """Сохраняет зависимости."""
        self._redis = redis
        self._ttl = ttl_seconds

    async def _members(self, user_id: UUID) -> set[str]:
        """Возвращает sid всех сессий пользователя."""
        return await cast(Awaitable[set[str]], self._redis.smembers(_user_key(user_id)))

    async def save(self, session: SessionData) -> None:
        """Сохраняет сессию и добавляет её sid в набор сессий пользователя."""
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.set(_session_key(session.sid), _dump(session), ex=self._ttl)
            pipe.sadd(_user_key(session.user_id), session.sid)
            pipe.expire(_user_key(session.user_id), self._ttl)
            await pipe.execute()

    async def get(self, sid: str) -> SessionData | None:
        """Возвращает сессию по sid; None, если её нет."""
        raw = await self._redis.get(_session_key(sid))
        return _load(sid, raw) if raw else None

    async def touch(self, session: SessionData) -> None:
        """Продлевает срок жизни сессии и набора сессий пользователя."""
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.expire(_session_key(session.sid), self._ttl)
            pipe.expire(_user_key(session.user_id), self._ttl)
            await pipe.execute()

    async def delete(self, sid: str, user_id: UUID) -> None:
        """Удаляет сессию и убирает её sid из набора сессий пользователя."""
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.delete(_session_key(sid))
            pipe.srem(_user_key(user_id), sid)
            await pipe.execute()

    async def delete_all(self, user_id: UUID) -> None:
        """Удаляет все сессии пользователя."""
        sids = await self._members(user_id)
        async with self._redis.pipeline(transaction=True) as pipe:
            for sid in sids:
                pipe.delete(_session_key(sid))
            pipe.delete(_user_key(user_id))
            await pipe.execute()

    async def set_roles(self, user_id: UUID, roles: frozenset[Role]) -> None:
        """Обновляет набор ролей во всех сессиях пользователя, убирая из набора ссылки на уже истёкшие."""
        for sid in await self._members(user_id):
            current = await self.get(sid)
            if current is None:
                await cast(Awaitable[int], self._redis.srem(_user_key(user_id), sid))
                continue
            await self._redis.set(_session_key(sid), _dump(replace(current, roles=roles)), keepttl=True)
