from typing import Annotated

from fastapi import APIRouter, Body, Path, status

from auth.dependencies import AccountDep, CurrentUserDep, RolesDep
from auth.domain.roles import Roles
from auth.features.me.schemas import MeOut, ProfileIn, RefOut, RoleOut, RoleRequestIn
from core.request import ClientIp
from infrastructure.enums import Role
from infrastructure.user import UserModel

router = APIRouter(prefix="/me", tags=["me"])


def _me_out(user: UserModel) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        last_name=user.last_name,
        first_name=user.first_name,
        middle_name=user.middle_name,
        birth_date=user.birth_date,
        academic_group=RefOut.model_validate(user.academic_group) if user.academic_group else None,
        roles=[RoleOut.model_validate(item) for item in user.roles],
        available_roles=sorted(Roles.granted_roles(user)),
    )


@router.get("")
async def get_me(user: CurrentUserDep, accounts: AccountDep) -> MeOut:
    return _me_out(await accounts.get_me(user.id, user.roles))


@router.patch("")
async def update_me(
    body: Annotated[ProfileIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    accounts: AccountDep,
) -> MeOut:
    return _me_out(await accounts.update_profile(user.id, body.academic_group_id, ip))


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def request_role(
    body: Annotated[RoleRequestIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    roles: RolesDep,
) -> MeOut:
    return _me_out(await roles.request(user.id, body.role, ip))


@router.post("/roles/{role}/onboarding", status_code=status.HTTP_204_NO_CONTENT)
async def complete_onboarding(
    role: Annotated[Role, Path()],
    user: CurrentUserDep,
    roles: RolesDep,
) -> None:
    await roles.complete_onboarding(user.id, role)
