from uuid import UUID

from redis.asyncio import Redis


def _key(purpose: str, user_id: UUID, postfix: str) -> str:
    """Строит ключ Redis для кода указанного назначения."""
    return f"code:{purpose}:{user_id}:{postfix}"


class CodeRepository:
    def __init__(self, redis: Redis) -> None:
        """Сохраняет зависимость."""
        self._redis = redis

    async def hold(self, purpose: str, user_id: UUID, seconds: int) -> bool:
        """Ставит задержку на повторную отправку кода; False, если задержка уже идёт."""
        return bool(await self._redis.set(_key(purpose, user_id, "cooldown"), "1", nx=True, ex=seconds))

    async def hold_left(self, purpose: str, user_id: UUID) -> int:
        """Сколько секунд осталось до возможности запросить новый код."""
        return max(0, int(await self._redis.ttl(_key(purpose, user_id, "cooldown"))))

    async def save(self, purpose: str, user_id: UUID, value: str, ttl_seconds: int) -> None:
        """Сохраняет код и сбрасывает счётчик неудачных попыток."""
        await self._redis.set(_key(purpose, user_id, "token"), value, ex=ttl_seconds)
        await self._redis.delete(_key(purpose, user_id, "counter"))

    async def get(self, purpose: str, user_id: UUID) -> str | None:
        """Возвращает сохранённый код; None, если он не выдан или устарел."""
        return await self._redis.get(_key(purpose, user_id, "token"))

    async def fail(self, purpose: str, user_id: UUID, ttl_seconds: int) -> int:
        """Увеличивает счётчик неудачных попыток и возвращает его значение."""
        key = _key(purpose, user_id, "counter")
        count = int(await self._redis.incr(key))
        if count == 1:
            await self._redis.expire(key, ttl_seconds)
        return count

    async def drop(self, purpose: str, user_id: UUID) -> None:
        """Удаляет код и счётчик попыток."""
        await self._redis.delete(_key(purpose, user_id, "token"), _key(purpose, user_id, "counter"))
