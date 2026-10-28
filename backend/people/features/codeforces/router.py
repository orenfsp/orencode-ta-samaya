from typing import Annotated

from fastapi import APIRouter, Body, status

from auth.dependencies import CurrentUserDep
from people.dependencies import CodeforcesDep
from people.features.codeforces.schemas import CodeforcesOut, HandleIn
from core.errors import NotFound
from core.request import ClientIp

router = APIRouter(prefix="/me/codeforces", tags=["Codeforces"])


@router.put("", summary="Сохранить хэндл и сразу обновить рейтинг")
async def save(body: Annotated[HandleIn, Body()], user: CurrentUserDep, ip: ClientIp, codeforces: CodeforcesDep) -> CodeforcesOut:
    """Привязывает хэндл Codeforces текущему пользователю и возвращает обновлённый профиль."""
    result = CodeforcesOut.of(await codeforces.set_handle(user.id, body.handle, ip))
    if result is None:
        raise NotFound()
    return result


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, summary="Убрать хэндл")
async def remove(user: CurrentUserDep, ip: ClientIp, codeforces: CodeforcesDep) -> None:
    """Отвязывает хэндл Codeforces текущего пользователя."""
    await codeforces.remove(user.id, ip)
