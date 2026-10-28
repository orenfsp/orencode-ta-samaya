from typing import Annotated

from fastapi import Depends, Request


def client_ip(request: Request) -> str | None:
    """Возвращает IP клиента из запроса или None, если он неизвестен."""
    return request.client.host if request.client else None


ClientIp = Annotated[str | None, Depends(client_ip)]
