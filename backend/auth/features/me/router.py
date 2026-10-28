from typing import Annotated

from fastapi import APIRouter, Body, Path, status

from auth.dependencies import AccountDep, CurrentUserDep, RolesDep
from auth.domain.roles import Roles
from auth.features.me.schemas import CodeforcesOut, MeOut, ProfileIn, RefOut, RoleOut, RoleRequestIn
from core.request import ClientIp
from infrastructure.enums import CodeforcesStatus, Role
from infrastructure.account.user import UserModel

router = APIRouter(prefix="/me", tags=["me"])


def _me_out(user: UserModel) -> MeOut:
    """Собирает схему профиля пользователя с ролями и статусом Codeforces."""
    return MeOut(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified_at is not None,
        last_name=user.last_name,
        first_name=user.first_name,
        middle_name=user.middle_name,
        birth_date=user.birth_date,
        academic_group=RefOut.model_validate(user.academic_group) if user.academic_group else None,
        roles=[RoleOut.model_validate(item) for item in user.roles],
        available_roles=sorted(Roles.granted_roles(user)),
        codeforces=CodeforcesOut(
            handle=user.codeforces_handle,
            url=f"https://codeforces.com/profile/{user.codeforces_handle}",
            rating=user.codeforces_rating,
            max_rating=user.codeforces_max_rating,
            rank=user.codeforces_rank,
            status=user.codeforces_status or CodeforcesStatus.PENDING,
            updated_at=user.codeforces_updated_at,
        )
        if user.codeforces_handle
        else None,
    )


@router.get("")
async def get_me(user: CurrentUserDep, accounts: AccountDep) -> MeOut:
    """Возвращает профиль текущего пользователя."""
    return _me_out(await accounts.get_me(user.id, user.granted or user.roles))


@router.patch("")
async def update_me(
    body: Annotated[ProfileIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    accounts: AccountDep,
) -> MeOut:
    """Обновляет переданные поля профиля текущего пользователя."""
    return _me_out(await accounts.update_profile(user.id, body.model_dump(include=body.model_fields_set), ip))


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def request_role(
    body: Annotated[RoleRequestIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    roles: RolesDep,
) -> MeOut:
    """Запрашивает у текущего пользователя новую роль."""
    return _me_out(await roles.request(user.id, body.role, ip))


@router.post("/roles/{role}/onboarding", status_code=status.HTTP_204_NO_CONTENT)
async def complete_onboarding(
    role: Annotated[Role, Path()],
    user: CurrentUserDep,
    roles: RolesDep,
) -> None:
    """Отмечает завершение онбординга для роли текущего пользователя."""
    await roles.complete_onboarding(user.id, role)
