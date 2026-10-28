import asyncio
import logging
from collections.abc import Callable
from contextlib import suppress
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from notifications.domain.bot_dialog import COMMANDS, BotDialog, Reply
from notifications.clients.telegram import TelegramBlocked, TelegramClient


class TelegramBot:
    """Опрос обновлений Telegram и доставка ответов диалога в чат."""

    RETRY_SECONDS = 5

    def __init__(self, sessions: async_sessionmaker[AsyncSession], api: TelegramClient,
                 dialog: Callable[[AsyncSession], BotDialog]) -> None:
        """Сохраняет зависимости."""
        self._sessions, self._api, self._dialog = sessions, api, dialog
        self._logger = logging.getLogger("fsp.telegram")

    async def run(self) -> None:
        """Бесконечно опрашивает Telegram за обновлениями и обрабатывает каждое."""
        with suppress(Exception):
            await self._api.commands(COMMANDS)
        offset: int | None = None
        while True:
            try:
                updates = await self._api.updates(offset)
            except Exception as error:
                self._logger.warning("Telegram polling failed: kind=%s", type(error).__name__)
                await asyncio.sleep(self.RETRY_SECONDS)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                try:
                    await self._handle(update)
                except TelegramBlocked:
                    pass
                except Exception as error:
                    self._logger.warning("Telegram update failed: kind=%s", type(error).__name__)

    async def _handle(self, update: dict[str, Any]) -> None:
        """Передаёт входящий callback или сообщение диалогу бота и доставляет его ответы."""
        async with self._sessions() as db:
            dialog = self._dialog(db)
            if "callback_query" in update:
                query = update["callback_query"]
                replies = await dialog.callback(query)
                await self._api.answer(query["id"], next((reply.toast for reply in replies if reply.toast), None))
                await self._deliver(query["message"]["chat"]["id"], query["message"]["message_id"], replies)
            elif "message" in update:
                message = update["message"]
                await self._deliver(message["chat"]["id"], None, await dialog.message(message))

    async def _deliver(self, chat_id: int, message_id: int | None, replies: list[Reply]) -> None:
        """Отправляет ответы бота в чат, редактируя исходное сообщение, если это указано."""
        for reply in replies:
            if not reply.text:
                continue
            if reply.edit and message_id is not None:
                await self._api.edit(chat_id, message_id, reply.text, reply.buttons)
            else:
                await self._api.send(chat_id, reply.text, reply.buttons, reply.keyboard)
