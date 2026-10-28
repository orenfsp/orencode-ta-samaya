from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query, status

from auth.dependencies import CurrentUser, CurrentUserDep, require_role
from core.request import ClientIp
from disputes.dependencies import DisputesDep
from disputes.domain.disputes import entry_title
from disputes.features.schemas import (
    AppealableContestOut,
    AppealableList,
    AppealableOut,
    AppealDecisionIn,
    AppealIn,
    AppealOut,
    ContestDisputesOut,
    DisputeListOut,
    EntryOut,
    ParticipantOut,
    PersonOut,
    ViolationDecisionIn,
    ViolationIn,
    ViolationOut,
)
from infrastructure.disputes.appeal import AppealModel
from infrastructure.enums import Role

router = APIRouter(tags=["Апелляции и нарушения"])
Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
AppealId = Annotated[UUID, Path()]


def _appeal(item: AppealModel) -> AppealOut:
    """Строит схему апелляции с названием заявки."""
    return AppealOut.of(item, entry_title(item.application))


@router.get("/contests/{contest_id}/disputes", summary="Апелляции и нарушения соревнования")
async def contest_disputes(contest_id: Annotated[int, Path()], user: CurrentUserDep, disputes: DisputesDep) -> ContestDisputesOut:
    """Возвращает апелляции и нарушения в пределах прав, свои заявки для апелляции и участников для рапорта."""
    found = await disputes.contest(user.id, user.roles, contest_id)
    return ContestDisputesOut(
        privileged=found.privileged,
        can_report=found.can_report,
        appeal_until=found.appeal_until,
        appeals=[_appeal(item) for item in found.appeals],
        violations=[ViolationOut.of(item, found.privileged) for item in found.violations],
        entries=[EntryOut(application_id=item.id, title=entry_title(item), place=place) for item, place in found.entries],
        participants=[
            ParticipantOut(application_id=application_id, athlete=PersonOut.of(member), team_name=team)
            for application_id, member, team in found.participants
        ],
    )


@router.post("/contests/{contest_id}/appeals", status_code=status.HTTP_201_CREATED, summary="Подать апелляцию на результат")
async def file_appeal(
    contest_id: Annotated[int, Path()], body: Annotated[AppealIn, Body()], user: CurrentUserDep, ip: ClientIp, disputes: DisputesDep
) -> AppealOut:
    """Участник, автор заявки или тренер участника подаёт апелляцию на место с доказательствами."""
    item = await disputes.file_appeal(
        user.id, contest_id, body.application_id, body.requested_place, body.reason, body.evidence_url, body.file_ids, ip
    )
    return _appeal(item)


@router.post("/appeals/{appeal_id}/withdraw", summary="Отозвать свою апелляцию")
async def withdraw(appeal_id: AppealId, user: CurrentUserDep, ip: ClientIp, disputes: DisputesDep) -> AppealOut:
    """Отзывает свою апелляцию, пока нет решения."""
    return _appeal(await disputes.withdraw(user.id, appeal_id, ip))


@router.post("/contests/{contest_id}/violations", status_code=status.HTTP_201_CREATED, summary="Рапорт о нарушении")
async def report(
    contest_id: Annotated[int, Path()], body: Annotated[ViolationIn, Body()], user: CurrentUserDep, ip: ClientIp, disputes: DisputesDep
) -> ViolationOut:
    """Судья коллегии или федерация сообщает о нарушении участника."""
    item = await disputes.report(user.id, user.roles, contest_id, body.user_id, body.description, body.evidence_url, body.file_ids, ip)
    return ViolationOut.of(item, True)


@router.get("/me/appealable", summary="Где можно подать апелляцию сейчас")
async def appealable(user: CurrentUserDep, disputes: DisputesDep) -> AppealableList:
    """Соревнования с внесёнными местами и открытым сроком, где человек участник, автор заявки или тренер участника."""
    return AppealableList(
        items=[
            AppealableOut(
                contest=AppealableContestOut(id=contest.id, title=contest.title, starts_on=contest.starts_on, ends_on=contest.ends_on),
                appeal_until=until,
                entries=[EntryOut(application_id=item.id, title=entry_title(item), place=place) for item, place in entries],
            )
            for contest, until, entries in await disputes.appealable(user.id)
        ]
    )


@router.get("/me/disputes", summary="Мои апелляции и решения по нарушениям")
async def mine(user: CurrentUserDep, disputes: DisputesDep) -> DisputeListOut:
    """Возвращает апелляции по своим заявкам и решения по нарушениям о себе."""
    appeals, violations = await disputes.mine(user.id)
    return DisputeListOut(appeals=[_appeal(item) for item in appeals], violations=[ViolationOut.of(item, False) for item in violations])


@router.get("/admin/disputes", summary="Очередь апелляций и нарушений")
async def queue(_: Federation, disputes: DisputesDep, include_closed: Annotated[bool, Query()] = False) -> DisputeListOut:
    """Возвращает апелляции и рапорты; по умолчанию только ждущие решения."""
    appeals, violations = await disputes.queue(not include_closed)
    return DisputeListOut(appeals=[_appeal(item) for item in appeals], violations=[ViolationOut.of(item, True) for item in violations])


@router.post("/admin/appeals/{appeal_id}/review", summary="Взять апелляцию на рассмотрение")
async def review(appeal_id: AppealId, user: Federation, ip: ClientIp, disputes: DisputesDep) -> AppealOut:
    """Переводит апелляцию в «на рассмотрении» и уведомляет участников."""
    return _appeal(await disputes.review(user.id, appeal_id, ip))


@router.post("/admin/appeals/{appeal_id}/decide", summary="Решение по апелляции")
async def decide_appeal(
    appeal_id: AppealId, body: Annotated[AppealDecisionIn, Body()], user: Federation, ip: ClientIp, disputes: DisputesDep
) -> AppealOut:
    """Удовлетворяет апелляцию с правкой мест или отклоняет её с обоснованием."""
    places = [(item.application_id, item.place) for item in body.places]
    return _appeal(await disputes.decide_appeal(user.id, appeal_id, body.upheld, body.decision, places, ip))


@router.post("/admin/violations/{violation_id}/decide", summary="Решение по нарушению")
async def decide_violation(
    violation_id: Annotated[UUID, Path()], body: Annotated[ViolationDecisionIn, Body()], user: Federation, ip: ClientIp, disputes: DisputesDep
) -> ViolationOut:
    """Применяет санкцию или закрывает рапорт без санкции."""
    item = await disputes.decide_violation(user.id, violation_id, body.sanction, body.decision, body.suspended_until, ip)
    return ViolationOut.of(item, True)
