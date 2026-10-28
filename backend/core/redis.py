from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from core.config import settings

redis_client: Redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> Redis:
    """Отдаёт общий клиент Redis через Depends."""
    return redis_client


RedisClient = Annotated[Redis, Depends(get_redis)]
