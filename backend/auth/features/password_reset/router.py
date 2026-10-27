from typing import Annotated

from fastapi import APIRouter, Body, Response, status

from auth.dependencies import AccountDep, clear_auth_cookies
from auth.features.password_reset.schemas import ForgotIn, ResetIn
from core.request import ClientIp

router = APIRouter(prefix="/auth/password", tags=["auth"])


@router.post("/forgot", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    body: Annotated[ForgotIn, Body()],
    ip: ClientIp,
    accounts: AccountDep,
) -> None:
    await accounts.forgot_password(body.email, ip)


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    body: Annotated[ResetIn, Body()],
    response: Response,
    ip: ClientIp,
    accounts: AccountDep,
) -> None:
    await accounts.reset_password(body.token, body.password, ip)
    clear_auth_cookies(response)
