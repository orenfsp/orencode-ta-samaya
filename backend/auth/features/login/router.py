from typing import Annotated

from fastapi import APIRouter, Body, Request, Response

from auth.dependencies import SID_COOKIE, AccountDep, set_auth_cookies
from auth.features.login.schemas import LoginIn, LoginOut
from core.request import ClientIp

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(
    body: Annotated[LoginIn, Body()],
    request: Request,
    response: Response,
    ip: ClientIp,
    accounts: AccountDep,
) -> LoginOut:
    user = await accounts.authenticate(body.email, body.password, ip)
    session = await accounts.start_session(request.cookies.get(SID_COOKIE), user)
    set_auth_cookies(response, session)
    return LoginOut.model_validate(user)
