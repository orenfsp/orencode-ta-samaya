from typing import Any

import httpx

POLL_SECONDS = 25

Button = tuple[str, str]
Buttons = list[list[Button]]


class TelegramBlocked(Exception):
    pass


def _inline(rows: Buttons) -> dict[str, Any]:
    """Строит разметку inline-клавиатуры Telegram из кнопок со ссылками или callback-данными."""
    return {"inline_keyboard": [[{"text": text, "url": value} if value.startswith("http")
                                 else {"text": text, "callback_data": value} for text, value in row] for row in rows]}


class TelegramClient:
    """Клиент Telegram Bot API: опрос обновлений и отправка сообщений."""

    def __init__(self, token: str) -> None:
        """Создаёт HTTP-клиент с базовым URL Telegram Bot API."""
        self._client = httpx.AsyncClient(base_url=f"https://api.telegram.org/bot{token}/", timeout=POLL_SECONDS + 10)

    async def updates(self, offset: int | None) -> list[dict[str, Any]]:
        """Забирает новые обновления бота методом long polling."""
        body: dict[str, Any] = {"timeout": POLL_SECONDS, "allowed_updates": ["message", "callback_query"]}
        if offset is not None:
            body["offset"] = offset
        return await self._call("getUpdates", body)

    async def send(self, chat_id: int, text: str, buttons: Buttons | None = None,
                   keyboard: list[list[str]] | None = None) -> None:
        """Отправляет сообщение в чат с inline-кнопками или клавиатурой меню."""
        body: dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                                "link_preview_options": {"is_disabled": True}}
        if buttons:
            body["reply_markup"] = _inline(buttons)
        elif keyboard:
            body["reply_markup"] = {"keyboard": [[{"text": text} for text in row] for row in keyboard],
                                    "resize_keyboard": True, "is_persistent": True}
        await self._call("sendMessage", body)

    async def edit(self, chat_id: int, message_id: int, text: str, buttons: Buttons | None = None) -> None:
        """Редактирует текст и кнопки существующего сообщения; при неудаче отправляет новое."""
        body: dict[str, Any] = {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML",
                                "link_preview_options": {"is_disabled": True},
                                "reply_markup": _inline(buttons or [])}
        try:
            await self._call("editMessageText", body)
        except RuntimeError:
            await self.send(chat_id, text, buttons)

    async def answer(self, callback_id: str, text: str | None = None) -> None:
        """Отвечает на нажатие inline-кнопки, опционально показывая всплывающий текст."""
        body: dict[str, Any] = {"callback_query_id": callback_id}
        if text:
            body["text"] = text
        await self._call("answerCallbackQuery", body)

    async def commands(self, items: list[tuple[str, str]]) -> None:
        """Устанавливает список команд бота, видимых в интерфейсе Telegram."""
        await self._call("setMyCommands", {"commands": [{"command": name, "description": text} for name, text in items]})

    async def close(self) -> None:
        """Закрывает HTTP-клиент бота."""
        await self._client.aclose()

    async def _call(self, method: str, body: dict[str, Any]) -> Any:
        """Вызывает метод Telegram Bot API; бросает TelegramBlocked при 403 и RuntimeError при ошибке."""
        response = await self._client.post(method, json=body)
        if response.status_code == 403:
            raise TelegramBlocked(method)
        data = response.json()
        if not data.get("ok"):
            raise RuntimeError(f"telegram_{response.status_code}")
        return data["result"]
