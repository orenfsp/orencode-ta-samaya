from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query, status

from applications.dependencies import ApplicationsDep
from applications.features.participant.schemas import (
    ApplicationIn,
    ApplicationList,
    ApplicationOut,
    AthleteList,
    AthletesIn,
    AthleteOut,
    AvailableList,
    AvailableOut,
    ContestBriefOut,
    MemberIn,
    RepeatIn,
    TeamNameIn,
)
from auth.dependencies import CurrentUser, CurrentUserDep, current_user
from core.errors import Forbidden
from core.request import ClientIp
from infrastructure.enums import ApplicationCreator, Role

router = APIRouter(tags=["Заявки: спортсмен и тренер"])

PARTICIPANT_ROLES = frozenset({Role.ATHLETE, Role.COACH})


async def participant(user: Annotated[CurrentUser, Depends(current_user)]) -> CurrentUser:
    """Пропускает только пользователей с ролью спортсмена или тренера."""
    if not user.roles & PARTICIPANT_ROLES:
        raise Forbidden()
    return user


Participant = Annotated[CurrentUser, Depends(participant)]
ApplicationId = Annotated[int, Path()]


@router.get("/athletes/search", summary="Найти спортсмена для заявки")
async def search_athletes(
    user: Participant,
    applications: ApplicationsDep,
    q: Annotated[str, Query(min_length=2, max_length=200)],
    contest_id: Annotated[int | None, Query()] = None,
) -> AthleteList:
    """Ищет спортсменов по тексту для добавления в заявку, отмечая проблемы допуска."""
    users, problems = await applications.search_athletes(q, contest_id)
    return AthleteList(
        items=[
            AthleteOut.model_validate(item).model_copy(update={"problems": problems.get(item.id)})
            for item in users
        ]
    )


@router.get("/me/available-contests", summary="Куда можно записаться")
async def available_contests(
    user: Participant,
    applications: ApplicationsDep,
    as_: Annotated[ApplicationCreator | None, Query(alias="as")] = None,
) -> AvailableList:
    """Возвращает соревнования, открытые для подачи заявки текущим пользователем."""
    role = as_ or (ApplicationCreator.ATHLETE if Role.ATHLETE in user.roles else ApplicationCreator.COACH)
    items = await applications.available(user.id, user.roles, role)
    return AvailableList(
        items=[
            AvailableOut(contest=ContestBriefOut.model_validate(item), problems=problems)
            for item, problems in items
        ]
    )


@router.get("/me/applications", summary="Мои заявки")
async def my_applications(
    user: Participant,
    applications: ApplicationsDep,
    as_: Annotated[ApplicationCreator, Query(alias="as")] = ApplicationCreator.ATHLETE,
) -> ApplicationList:
    """Возвращает заявки текущего пользователя как спортсмена или как тренера."""
    if Role(as_.value) not in user.roles:
        raise Forbidden()
    items = await applications.mine(user.id, as_)
    return ApplicationList(items=[ApplicationOut.model_validate(item) for item in items])


@router.post("/contests/{contest_id}/applications", status_code=status.HTTP_201_CREATED, summary="Подать заявку")
async def create_application(
    contest_id: Annotated[int, Path()],
    body: Annotated[ApplicationIn, Body()],
    user: Participant,
    ip: ClientIp,
    applications: ApplicationsDep,
) -> ApplicationOut:
    """Создаёт новую заявку на соревнование."""
    item = await applications.create(
        user.id, user.roles, contest_id, body.as_, body.team_name, body.member_ids, body.captain_id, ip
    )
    return ApplicationOut.model_validate(item)


@router.post(
    "/contests/{contest_id}/applications/batch",
    status_code=status.HTTP_201_CREATED,
    summary="Тренер: личные заявки сразу на нескольких спортсменов",
)
async def create_for_athletes(
    contest_id: Annotated[int, Path()],
    body: Annotated[AthletesIn, Body()],
    user: Participant,
    ip: ClientIp,
    applications: ApplicationsDep,
) -> ApplicationList:
    """Тренер создаёт личные заявки сразу на нескольких указанных спортсменов."""
    items = await applications.create_for_athletes(user.id, user.roles, contest_id, body.member_ids, ip)
    return ApplicationList(items=[ApplicationOut.model_validate(item) for item in items])


@router.post(
    "/contests/{contest_id}/applications/repeat",
    status_code=status.HTTP_201_CREATED,
    summary="Подать заявку тем же составом, что на прошлом соревновании",
)
async def repeat_application(
    contest_id: Annotated[int, Path()],
    body: Annotated[RepeatIn, Body()],
    user: Participant,
    ip: ClientIp,
    applications: ApplicationsDep,
) -> ApplicationOut:
    """Повторяет свою прошлую заявку тем же составом на новом соревновании."""
    item = await applications.repeat(user.id, user.roles, contest_id, body.source_application_id, ip)
    return ApplicationOut.model_validate(item)


@router.get("/applications/{application_id}", summary="Заявка")
async def get_application(application_id: ApplicationId, user: CurrentUserDep, applications: ApplicationsDep) -> ApplicationOut:
    """Возвращает заявку по id, если у пользователя есть право её видеть."""
    return ApplicationOut.model_validate(await applications.get(user.id, user.roles, application_id))


@router.patch("/applications/{application_id}", summary="Переименовать команду")
async def rename_application(
    application_id: ApplicationId,
    body: Annotated[TeamNameIn, Body()],
    user: Participant,
    ip: ClientIp,
    applications: ApplicationsDep,
) -> ApplicationOut:
    """Переименовывает команду в заявке."""
    return ApplicationOut.model_validate(await applications.rename(user.id, application_id, body.team_name, ip))


@router.post("/applications/{application_id}/members", summary="Пригласить в команду")
async def add_member(
    application_id: ApplicationId,
    body: Annotated[MemberIn, Body()],
    user: Participant,
    ip: ClientIp,
    applications: ApplicationsDep,
) -> ApplicationOut:
    """Приглашает спортсмена в состав командной заявки."""
    return ApplicationOut.model_validate(await applications.add_member(user.id, application_id, body.user_id, ip))


@router.delete("/applications/{application_id}/members/{user_id}", summary="Убрать из команды")
async def remove_member(
    application_id: ApplicationId,
    user_id: Annotated[UUID, Path()],
    user: Participant,
    ip: ClientIp,
    applications: ApplicationsDep,
) -> ApplicationOut:
    """Убирает участника из командной заявки."""
    return ApplicationOut.model_validate(await applications.remove_member(user.id, application_id, user_id, ip))


@router.post("/applications/{application_id}/submit", summary="Подать на рассмотрение")
async def submit_application(
    application_id: ApplicationId, user: Participant, ip: ClientIp, applications: ApplicationsDep
) -> ApplicationOut:
    """Подаёт заявку на модерацию."""
    return ApplicationOut.model_validate(await applications.submit(user.id, application_id, ip))


@router.post("/applications/{application_id}/withdraw", summary="Отозвать заявку")
async def withdraw_application(
    application_id: ApplicationId, user: Participant, ip: ClientIp, applications: ApplicationsDep
) -> ApplicationOut:
    """Отзывает заявку целиком."""
    return ApplicationOut.model_validate(await applications.withdraw(user.id, application_id, ip))


@router.post("/applications/{application_id}/confirm", summary="Подтвердить участие")
async def confirm_application(
    application_id: ApplicationId, user: CurrentUserDep, ip: ClientIp, applications: ApplicationsDep
) -> ApplicationOut:
    """Подтверждает участие в заявке."""
    return ApplicationOut.model_validate(await applications.confirm(user.id, application_id, ip))


@router.post("/applications/{application_id}/decline", summary="Отказаться от участия")
async def decline_application(
    application_id: ApplicationId, user: CurrentUserDep, ip: ClientIp, applications: ApplicationsDep
) -> ApplicationOut:
    """Отказывается от участия в заявке."""
    return ApplicationOut.model_validate(await applications.decline(user.id, application_id, ip))
