from typing import Any

import httpx


class CodeforcesUnavailable(Exception):
    pass


class CodeforcesClient:
    """HTTP-клиент к публичному API Codeforces."""

    def __init__(self, base_url: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        """Сохраняет базовый URL и, если задан, транспорт для запросов."""
        self._base_url = base_url.rstrip("/")
        self._transport = transport

    async def user_info(self, handles: list[str]) -> dict[str, Any]:
        """Запрашивает user.info для списка хэндлов; возвращает разобранное тело ответа."""
        try:
            async with httpx.AsyncClient(timeout=20, transport=self._transport) as client:
                response = await client.get(f"{self._base_url}/user.info", params={"handles": ";".join(handles)})
        except httpx.HTTPError as error:
            raise CodeforcesUnavailable(str(error)) from error
        try:
            body = response.json()
        except ValueError as error:
            raise CodeforcesUnavailable(f"HTTP {response.status_code}") from error
        if not isinstance(body, dict):
            raise CodeforcesUnavailable(f"HTTP {response.status_code}")
        return body
