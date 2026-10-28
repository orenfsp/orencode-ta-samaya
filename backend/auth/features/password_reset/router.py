from typing import Annotated

from fastapi import APIRouter, Body, Response, status

from auth.dependencies import AccountDep, clear_auth_cookies
from auth.features.password_reset.schemas import ForgotIn, ResetIn, VerifyIn, VerifyOut
from core.request import ClientIp

router = APIRouter(prefix="/auth/password", tags=["auth"])


@router.post("/forgot", status_code=status.HTTP_202_ACCEPTED, summary="Отправить код на почту")
async def forgot_password(
    body: Annotated[ForgotIn, Body()],
    ip: ClientIp,
    accounts: AccountDep,
) -> None:
    """Отправляет код восстановления пароля на почту."""
    await accounts.forgot_password(body.email, ip)


@router.post("/verify", summary="Проверить код и получить токен смены пароля")
async def verify_code(body: Annotated[VerifyIn, Body()], accounts: AccountDep) -> VerifyOut:
    """Проверяет код восстановления и возвращает токен для смены пароля."""
    return VerifyOut(reset_token=await accounts.verify_reset_code(body.email, body.code))


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT, summary="Задать новый пароль")
async def reset_password(
    body: Annotated[ResetIn, Body()],
    response: Response,
    ip: ClientIp,
    accounts: AccountDep,
) -> None:
    """Устанавливает новый пароль по токену и завершает текущую сессию."""
    await accounts.reset_password(body.token, body.password, ip)
    clear_auth_cookies(response)
