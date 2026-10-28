from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from infrastructure.enums import WallRole
from people.dependencies import PeopleDep, ViewerDep, WallDep
from people.domain.wall import WallEntry
from people.features.wall.schemas import ContestOut, EntryOut, PhotoOut, PostIn, PostOut, SavedOut, WallList

router = APIRouter(tags=["Лента человека"])


def _entry(entry: WallEntry) -> EntryOut:
    """Собирает схему записи ленты из доменного объекта WallEntry."""
    post = entry.post
    return EntryOut(
        contest=ContestOut.model_validate(entry.contest),
        team_name=entry.team_name,
        athletes=entry.athletes,
        place=entry.place,
        disqualified=entry.disqualified,
        position=entry.position,
        post=PostOut(
            id=post.id,
            text=post.text,
            photos=[PhotoOut(id=photo.file.id, url=photo.url) for photo in entry.photos],
            is_hidden=post.is_hidden,
            hidden_by_federation=post.hidden_by_federation,
        )
        if post
        else None,
    )


@router.get("/people/{user_id}/wall", summary="Лента человека по роли")
async def wall(
    user_id: Annotated[UUID, Path()],
    role: Annotated[WallRole, Query()],
    viewer: ViewerDep,
    people: PeopleDep,
    wall: WallDep,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> WallList:
    """Отдаёт страницу ленты человека в выбранной роли."""
    person = await people.get(viewer, user_id)
    items, total = await wall.entries(person, role, limit, offset)
    return WallList(items=[_entry(item) for item in items], total=total)


@router.put("/me/wall/{role}/{contest_id}", summary="Дописать пост к соревнованию")
async def save_post(
    role: Annotated[WallRole, Path()],
    contest_id: Annotated[int, Path()],
    body: Annotated[PostIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    wall: WallDep,
) -> SavedOut:
    """Сохраняет или обновляет пост текущего пользователя о соревновании."""
    post = await wall.save(user.id, role, contest_id, body.text, body.photo_ids, body.is_hidden, ip)
    return SavedOut(id=post.id, contest_id=post.contest_id, text=post.text, is_hidden=post.is_hidden)
