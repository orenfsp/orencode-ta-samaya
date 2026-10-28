import hashlib
from uuid import UUID

from redis.asyncio import Redis

VIEW_COOLDOWN_SECONDS = 86400


class NewsViewsRepository:
    """Учёт просмотров статьи в Redis с ограничением на одного посетителя."""

    def __init__(self, redis: Redis) -> None:
        """Сохраняет клиент Redis."""
        self._redis = redis

    async def first(self, article_id: UUID, visitor: str) -> bool:
        """Отмечает первый за сутки просмотр статьи посетителем; False, если он уже был."""
        key = f"news:{article_id}:{hashlib.sha256(visitor.encode()).hexdigest()}:cooldown"
        return bool(await self._redis.set(key, "1", nx=True, ex=VIEW_COOLDOWN_SECONDS))
