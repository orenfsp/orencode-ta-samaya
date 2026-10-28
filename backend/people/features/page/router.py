from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path
from fastapi.responses import RedirectResponse

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from infrastructure.enums import CodeforcesStatus
from people.dependencies import PeopleDep, ViewerDep
from people.domain.people import UNSET, Person, full_name, short_name
from people.features.page.schemas import CodeforcesOut, GroupOut, PageIn, PersonOut

router = APIRouter(tags=["Страница человека"])


def _out(person: Person) -> PersonOut:
    """Собирает схему страницы человека из доменного объекта Person."""
    user = person.user
    return PersonOut(
        id=user.id,
        name=short_name(user) if person.masked else full_name(user),
        last_name=None if person.masked else user.last_name,
        first_name=user.first_name,
        middle_name=None if person.masked else user.middle_name,
        birth_date=None if person.masked else user.birth_date,
        academic_group=GroupOut.model_validate(user.academic_group) if user.academic_group else None,
        avatar_url=person.avatar_url,
        roles=person.roles,
        is_owner=person.is_owner,
        masked=person.masked,
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


@router.get("/people/{user_id}", summary="Публичная страница человека")
async def person(user_id: Annotated[UUID, Path()], viewer: ViewerDep, people: PeopleDep) -> PersonOut:
    """Отдаёт публичную страницу человека с учётом прав зрителя."""
    return _out(await people.get(viewer, user_id))


@router.get("/people/{user_id}/avatar", summary="Фото человека: переадресация на файл, 404 — фото нет")
async def avatar(user_id: Annotated[UUID, Path()], viewer: ViewerDep, people: PeopleDep) -> RedirectResponse:
    """Переадресует на фото человека; браузер держит ответ пять минут, чтобы списки не дёргали API."""
    url = await people.avatar(viewer, user_id)
    return RedirectResponse(url, status_code=302, headers={"Cache-Control": "private, max-age=300"})


@router.patch("/me/page", summary="Настройки своей страницы")
async def update_page(
    body: Annotated[PageIn, Body()], user: CurrentUserDep, ip: ClientIp, people: PeopleDep
) -> PersonOut:
    """Обновляет аватар страницы текущего пользователя."""
    avatar = body.avatar_file_id if "avatar_file_id" in body.model_fields_set else UNSET
    return _out(await people.update_page(user.id, avatar, ip))
