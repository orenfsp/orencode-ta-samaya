from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, status
from pydantic import BaseModel, Field, StringConstraints

from auth.dependencies import CurrentUser, CurrentUserDep, require_role
from core.request import ClientIp
from evsk.dependencies import EvskDep
from evsk.domain.evsk import Candidate
from infrastructure.enums import Role
from infrastructure.qualifications.evsk_rule import EvskRuleModel

router = APIRouter(tags=["ЕВСК"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]


class Ref(BaseModel):
    id: int
    name: str


class RuleOut(BaseModel):
    id: int
    rank_type: Ref
    contest_level: Ref
    discipline: Ref | None
    place_to: int
    min_participants: int
    min_age: int | None
    max_age: int | None
    source: str | None
    is_demo: bool
    note: str | None

    @classmethod
    def of(cls, item: EvskRuleModel) -> "RuleOut":
        """Строит схему правила ЕВСК из модели."""
        return cls(
            id=item.id, rank_type=Ref(id=item.rank_type.id, name=item.rank_type.name),
            contest_level=Ref(id=item.contest_level.id, name=item.contest_level.name),
            discipline=Ref(id=item.discipline.id, name=item.discipline.name) if item.discipline else None,
            place_to=item.place_to, min_participants=item.min_participants, min_age=item.min_age,
            max_age=item.max_age, source=item.source, is_demo=item.is_demo, note=item.note,
        )


class RuleIn(BaseModel):
    rank_type_id: int = Field(ge=1)
    contest_level_id: int = Field(ge=1)
    discipline_id: int | None = Field(default=None, ge=1)
    place_to: int = Field(ge=1, le=100)
    min_participants: int = Field(default=0, ge=0, le=10000)
    min_age: int | None = Field(default=None, ge=5, le=100)
    max_age: int | None = Field(default=None, ge=5, le=100)
    source: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None
    is_demo: bool = False
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None


class CandidateOut(BaseModel):
    user_id: UUID
    name: str
    contest_id: int
    contest_title: str
    ends_on: date
    place: int
    result_id: int
    rank: str
    rank_type_id: int
    rule_demo: bool
    current: str | None


class StepOut(BaseModel):
    rank: Ref
    rules: list[RuleOut]


class ContestRef(BaseModel):
    id: int
    title: str
    starts_on: date
    level: str
    registration_closes_at: date


class PathOut(BaseModel):
    current: str | None
    current_valid_until: date | None
    next: StepOut | None
    later: list[Ref]
    contests: list[ContestRef]
    achieved: list[CandidateOut]


def _candidate(item: Candidate) -> CandidateOut:
    """Строит схему претендента на разряд."""
    user = item.user
    return CandidateOut(
        user_id=user.id, name=" ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part),
        contest_id=item.contest.id, contest_title=item.contest.title, ends_on=item.contest.ends_on,
        place=item.result.place or 0, result_id=item.result.id, rank=item.rule.rank_type.name,
        rank_type_id=item.rule.rank_type_id, rule_demo=item.rule.is_demo,
        current=item.current.item_name if item.current else None,
    )


@router.get("/admin/evsk/rules", summary="Правила ЕВСК: место → разряд")
async def rules(_: Federation, evsk: EvskDep) -> list[RuleOut]:
    """Возвращает правила ЕВСК."""
    return [RuleOut.of(item) for item in await evsk.rules()]


@router.post("/admin/evsk/rules", status_code=status.HTTP_201_CREATED, summary="Добавить правило")
async def create(body: Annotated[RuleIn, Body()], user: Federation, ip: ClientIp, evsk: EvskDep) -> RuleOut:
    """Создаёт правило ЕВСК."""
    return RuleOut.of(await evsk.save(user.id, None, body.model_dump(), ip))


@router.patch("/admin/evsk/rules/{rule_id}", summary="Изменить правило")
async def update(
    rule_id: Annotated[int, Path()], body: Annotated[RuleIn, Body()], user: Federation, ip: ClientIp, evsk: EvskDep
) -> RuleOut:
    """Правит правило ЕВСК."""
    return RuleOut.of(await evsk.save(user.id, rule_id, body.model_dump(), ip))


@router.delete("/admin/evsk/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить правило")
async def remove(rule_id: Annotated[int, Path()], user: Federation, ip: ClientIp, evsk: EvskDep) -> None:
    """Удаляет правило ЕВСК."""
    await evsk.remove(user.id, rule_id, ip)


@router.get("/admin/evsk/candidates", summary="Кто может претендовать на разряд по протоколам за год")
async def candidates(_: Federation, evsk: EvskDep) -> list[CandidateOut]:
    """Возвращает претендентов на разряд по соревнованиям за год."""
    return [_candidate(item) for item in await evsk.recent()]


@router.get("/contests/{contest_id}/evsk", summary="Подсветка ЕВСК по протоколу соревнования")
async def contest(contest_id: Annotated[int, Path()], user: CurrentUserDep, evsk: EvskDep) -> list[CandidateOut]:
    """Возвращает претендентов на разряд по местам соревнования."""
    return [_candidate(item) for item in await evsk.contest(user.id, user.roles, contest_id)]


@router.get("/me/path", summary="Личный путь: текущий разряд, что нужно для следующего, подходящие соревнования")
async def path(user: CurrentUserDep, evsk: EvskDep) -> PathOut:
    """Возвращает личный путь текущего спортсмена к следующему разряду."""
    found = await evsk.path(user.id)
    return PathOut(
        current=found.current.item_name if found.current else None,
        current_valid_until=found.current.valid_until if found.current else None,
        next=StepOut(rank=Ref(id=found.next.rank.id, name=found.next.rank.name),
                     rules=[RuleOut.of(rule) for rule in found.next.rules]) if found.next else None,
        later=[Ref(id=item.id, name=item.name) for item in found.later],
        contests=[ContestRef(id=item.id, title=item.title, starts_on=item.starts_on, level=item.contest_level.name,
                             registration_closes_at=item.registration_closes_at.date()) for item in found.contests],
        achieved=[_candidate(item) for item in found.achieved],
    )
