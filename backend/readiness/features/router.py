from typing import Annotated, Literal

from fastapi import APIRouter, Path
from pydantic import BaseModel

from auth.dependencies import CurrentUserDep
from readiness.dependencies import ReadinessDep

router = APIRouter(tags=["Готовность соревнования"])


class CheckOut(BaseModel):
    key: str
    step: Literal["prepare", "registration", "event", "after"]
    title: str
    done: bool
    hint: str
    warning: str | None


class ReadinessOut(BaseModel):
    contest_id: int
    done: int
    total: int
    items: list[CheckOut]


@router.get("/contests/{contest_id}/readiness", summary="Чек-лист готовности соревнования")
async def readiness(contest_id: Annotated[int, Path()], user: CurrentUserDep, checks: ReadinessDep) -> ReadinessOut:
    """Возвращает чек-лист готовности соревнования."""
    contest, items = await checks.contest(user.id, user.roles, contest_id)
    return ReadinessOut(
        contest_id=contest.id,
        done=sum(item.done for item in items),
        total=len(items),
        items=[CheckOut(key=item.key, step=item.step, title=item.title, done=item.done, hint=item.hint,
                        warning=item.warning) for item in items],
    )
