from typing import Annotated

from fastapi import APIRouter, Body, Request, Response, status

from auth.dependencies import SID_COOKIE, AccountDep, set_auth_cookies
from auth.features.register.schemas import RegisterIn, RegisterOut
from core.request import ClientIp

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: Annotated[RegisterIn, Body()],
    request: Request,
    response: Response,
    ip: ClientIp,
    accounts: AccountDep,
) -> RegisterOut:
    user = await accounts.register(
        email=body.email,
        password=body.password,
        last_name=body.last_name,
        first_name=body.first_name,
        middle_name=body.middle_name,
        birth_date=body.birth_date,
        roles=body.roles,
        ip=ip,
    )
    session = await accounts.start_session(request.cookies.get(SID_COOKIE), user)
    set_auth_cookies(response, session)
    return RegisterOut.model_validate(user)
