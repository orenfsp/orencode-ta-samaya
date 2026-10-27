from redis.asyncio import Redis


def _key(ip: str | None, email: str) -> str:
    return f"login:{ip or 'unknown'}:{email}:counter"


class LoginAttemptRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def failures(self, ip: str | None, email: str) -> int:
        value = await self._redis.get(_key(ip, email))
        return int(value) if value else 0

    async def retry_after(self, ip: str | None, email: str) -> int:
        return max(await self._redis.ttl(_key(ip, email)), 1)

    async def register_failure(self, ip: str | None, email: str, window_seconds: int) -> None:
        key = _key(ip, email)
        if await self._redis.incr(key) == 1:
            await self._redis.expire(key, window_seconds)

    async def reset(self, ip: str | None, email: str) -> None:
        await self._redis.delete(_key(ip, email))

    async def reset_email(self, email: str) -> None:
        keys = [key async for key in self._redis.scan_iter(match=f"login:*:{email}:counter")]
        if keys:
            await self._redis.delete(*keys)
