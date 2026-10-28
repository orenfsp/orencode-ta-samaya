from uuid import UUID

from redis.asyncio import Redis


def _key(token_hash: str) -> str:
    """Строит ключ Redis для токена сброса пароля."""
    return f"pwreset:{token_hash}:token"


class ResetTokenRepository:
    def __init__(self, redis: Redis) -> None:
        """Сохраняет зависимость."""
        self._redis = redis

    async def save(self, token_hash: str, user_id: UUID, ttl_seconds: int) -> None:
        """Сохраняет токен сброса пароля, привязанный к пользователю."""
        await self._redis.set(_key(token_hash), str(user_id), ex=ttl_seconds)

    async def pop(self, token_hash: str) -> UUID | None:
        """Забирает и удаляет id пользователя по токену; None, если токен не найден."""
        value = await self._redis.getdel(_key(token_hash))
        return UUID(value) if value else None
