from typing import Annotated

from fastapi import APIRouter, Body, Response, status

from auth.dependencies import AccountDep, CurrentUserDep, set_auth_cookies
from auth.features.email.schemas import ChangeIn, CodeIn
from core.request import ClientIp

router = APIRouter(prefix="/me/email", tags=["me"])


@router.post("/verify/send", status_code=status.HTTP_204_NO_CONTENT, summary="Отправить код подтверждения почты")
async def send_code(user: CurrentUserDep, accounts: AccountDep) -> Response:
    """Отправляет пользователю код подтверждения почты."""
    await accounts.send_email_code(user.id)
    return Response(status_code=204)


@router.post("/verify", status_code=status.HTTP_204_NO_CONTENT, summary="Подтвердить почту кодом")
async def verify(body: Annotated[CodeIn, Body()], user: CurrentUserDep, ip: ClientIp, accounts: AccountDep) -> Response:
    """Подтверждает почту пользователя кодом."""
    await accounts.confirm_email(user.id, body.code, ip)
    return Response(status_code=204)


@router.post("/change", status_code=status.HTTP_204_NO_CONTENT, summary="Отправить код на новую почту")
async def change(body: Annotated[ChangeIn, Body()], user: CurrentUserDep, accounts: AccountDep) -> Response:
    """Запрашивает смену почты: проверяет пароль и отправляет код на новый адрес."""
    await accounts.request_email_change(user.id, body.new_email, body.password)
    return Response(status_code=204)


@router.post("/change/confirm", status_code=status.HTTP_204_NO_CONTENT, summary="Подтвердить новую почту кодом")
async def confirm_change(body: Annotated[CodeIn, Body()], user: CurrentUserDep, ip: ClientIp,
                         accounts: AccountDep) -> Response:
    """Подтверждает смену почты кодом и открывает новую сессию с обновлённым адресом."""
    updated = await accounts.confirm_email_change(user.id, body.code, ip)
    response = Response(status_code=204)
    set_auth_cookies(response, await accounts.start_session(None, updated))
    return response
