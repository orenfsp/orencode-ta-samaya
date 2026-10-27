from fastapi import APIRouter, Response, status

from auth.dependencies import AccountDep, OptionalUserDep, clear_auth_cookies
from core.request import ClientIp

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    user: OptionalUserDep,
    ip: ClientIp,
    accounts: AccountDep,
) -> None:
    if user is not None:
        await accounts.logout(user.sid, user.id, ip)
    clear_auth_cookies(response)
