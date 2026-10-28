from uuid import UUID

from redis.asyncio import Redis


def _key(token: str) -> str:
    """Строит ключ Redis для одноразового токена привязки Telegram."""
    return f"tglink:{token}:token"


class TelegramTokenRepository:
    """Хранение одноразовых токенов привязки Telegram-аккаунта в Redis."""

    def __init__(self, redis: Redis) -> None:
        """Сохраняет клиент Redis."""
        self._redis = redis

    async def save(self, token: str, user_id: UUID, ttl_seconds: int) -> None:
        """Сохраняет токен привязки для пользователя на ограниченное время."""
        await self._redis.set(_key(token), str(user_id), ex=ttl_seconds)

    async def pop(self, token: str) -> UUID | None:
        """Забирает и удаляет id пользователя по токену; None, если токен не найден."""
        value = await self._redis.getdel(_key(token))
        return UUID(value) if value else None
