from redis.asyncio import Redis


class ForgotRequestRepository:
    def __init__(self, redis: Redis) -> None:
        """Сохраняет зависимость."""
        self._redis = redis

    async def hit(self, email: str, window_seconds: int) -> int:
        """Увеличивает счётчик запросов восстановления пароля для почты и возвращает его."""
        key = f"forgot:{email}:counter"
        count = await self._redis.incr(key)
        if count == 1:
            await self._redis.expire(key, window_seconds)
        return count
