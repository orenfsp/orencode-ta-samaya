import json
from typing import Any

from redis.asyncio import Redis

STATE_SECONDS = 600


def _key(chat_id: int) -> str:
    """Строит ключ Redis для состояния диалога чата."""
    return f"tgstate:{chat_id}:token"


class TelegramStateRepository:
    """Хранение временного состояния диалога Telegram-бота в Redis."""

    def __init__(self, redis: Redis) -> None:
        """Сохраняет клиент Redis."""
        self._redis = redis

    async def get(self, chat_id: int) -> dict[str, Any] | None:
        """Возвращает сохранённое состояние диалога чата или None."""
        raw = await self._redis.get(_key(chat_id))
        return json.loads(raw) if raw else None

    async def set(self, chat_id: int, state: dict[str, Any]) -> None:
        """Сохраняет состояние диалога чата с ограниченным сроком жизни."""
        await self._redis.set(_key(chat_id), json.dumps(state, ensure_ascii=False), ex=STATE_SECONDS)

    async def clear(self, chat_id: int) -> None:
        """Удаляет сохранённое состояние диалога чата."""
        await self._redis.delete(_key(chat_id))
