from typing import Annotated

from fastapi import Depends, Request


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


ClientIp = Annotated[str | None, Depends(client_ip)]
