from typing import Annotated

from fastapi import APIRouter, Body, Depends, Path, Query

from applications.dependencies import ApplicationsDep
from applications.features.moderation.schemas import (
    ApplicationList,
    ApplicationOut,
    ApplicationPage,
    ContestCountsOut,
    ContestCountsPage,
    ContestRowOut,
    IdsIn,
    RejectIn,
    RejectManyIn,
)
from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import ApplicationStatus, Role

ApplicationId = Annotated[int, Path()]
ContestId = Annotated[int, Path()]


def build(prefix: str, role: Role, tag: str) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])
    moderator = require_role(role)
    federation = role == Role.FEDERATION

    @router.get("/applications/contests", summary="Соревнования с заявками")
    async def contests_with_applications(
        user: Annotated[CurrentUser, Depends(moderator)],
        applications: ApplicationsDep,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> ContestCountsPage:
        items, total = await applications.moderation_contests(user.id, federation, limit, offset)
        return ContestCountsPage(
            items=[
                ContestCountsOut(contest=ContestRowOut.model_validate(item), counts=counts)
                for item, counts in items
            ],
            total=total,
        )

    @router.get("/contests/{contest_id}/applications", summary="Заявки соревнования")
    async def contest_applications(
        contest_id: ContestId,
        user: Annotated[CurrentUser, Depends(moderator)],
        applications: ApplicationsDep,
        status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
        search: Annotated[str | None, Query(max_length=200)] = None,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> ApplicationPage:
        items, total = await applications.moderation_list(
            user.id, federation, contest_id, status_filter, (search or "").strip() or None, limit, offset
        )
        return ApplicationPage(items=[ApplicationOut.model_validate(item) for item in items], total=total)

    @router.post("/applications/approve", summary="Одобрить несколько")
    async def approve_many(
        body: Annotated[IdsIn, Body()], user: Annotated[CurrentUser, Depends(moderator)], ip: ClientIp, applications: ApplicationsDep
    ) -> ApplicationList:
        items = await applications.approve(user.id, federation, body.ids, ip)
        return ApplicationList(items=[ApplicationOut.model_validate(item) for item in items])

    @router.post("/applications/reject", summary="Отклонить несколько")
    async def reject_many(
        body: Annotated[RejectManyIn, Body()], user: Annotated[CurrentUser, Depends(moderator)], ip: ClientIp, applications: ApplicationsDep
    ) -> ApplicationList:
        items = await applications.reject(user.id, federation, body.ids, body.reason, ip)
        return ApplicationList(items=[ApplicationOut.model_validate(item) for item in items])

    @router.post("/applications/{application_id}/approve", summary="Одобрить")
    async def approve(
        application_id: ApplicationId, user: Annotated[CurrentUser, Depends(moderator)], ip: ClientIp, applications: ApplicationsDep
    ) -> ApplicationOut:
        return ApplicationOut.model_validate((await applications.approve(user.id, federation, [application_id], ip))[0])

    @router.post("/applications/{application_id}/reject", summary="Отклонить")
    async def reject(
        application_id: ApplicationId,
        body: Annotated[RejectIn, Body()],
        user: Annotated[CurrentUser, Depends(moderator)],
        ip: ClientIp,
        applications: ApplicationsDep,
    ) -> ApplicationOut:
        items = await applications.reject(user.id, federation, [application_id], body.reason, ip)
        return ApplicationOut.model_validate(items[0])

    @router.post("/applications/{application_id}/reset", summary="Вернуть на рассмотрение")
    async def reset(
        application_id: ApplicationId, user: Annotated[CurrentUser, Depends(moderator)], ip: ClientIp, applications: ApplicationsDep
    ) -> ApplicationOut:
        return ApplicationOut.model_validate((await applications.reset(user.id, federation, [application_id], ip))[0])

    return router


organizer_router = build("/organizer", Role.ORGANIZER, "Заявки: организатор")
admin_router = build("/admin", Role.FEDERATION, "Заявки: федерация")
