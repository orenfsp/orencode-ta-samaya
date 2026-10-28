from dataclasses import dataclass, field
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import Forbidden, NotFound, ValidationFailed
from files.domain.files import Files
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import ContestStatus, Role, WallRole
from infrastructure.services.file import FileModel
from infrastructure.account.wall_post import WallPostModel
from infrastructure.account.wall_post_photo import WallPostPhotoModel
from people.domain.people import Person, page_roles
from people.repositories.pg_people import PersonRepository
from people.repositories.pg_wall import WallRepository

S = ContestStatus


@dataclass(frozen=True, slots=True)
class WallPhoto:
    file: FileModel
    url: str


@dataclass(slots=True)
class WallEntry:
    contest: ContestModel
    team_name: str | None = None
    athletes: int | None = None
    place: int | None = None
    disqualified: bool = False
    position: str | None = None
    post: WallPostModel | None = None
    photos: list[WallPhoto] = field(default_factory=list)


class Wall:
    """Лента соревнований пользователя и посты-отчёты по ним, с модерацией федерацией."""

    STATUSES = frozenset(set(S) - {S.DRAFT, S.ARCHIVED, S.CANCELLED})
    MAX_PHOTOS = 10

    def __init__(
        self, uow: UnitOfWork, wall: WallRepository, people: PersonRepository, files: Files, audit: Audit
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._wall = wall
        self._people = people
        self._files = files
        self._audit = audit

    async def entries(
        self, person: Person, role: WallRole, limit: int, offset: int
    ) -> tuple[list[WallEntry], int]:
        """Возвращает страницу записей стены пользователя в роли role с учётом видимости постов, и их общее число."""
        if Role(role.value) not in person.roles:
            raise NotFound()
        entries = await self._feed(person.user.id, role)
        posts = await self._wall.posts(person.user.id, role)
        visible: list[WallEntry] = []
        for entry in entries:
            post = posts.get(entry.contest.id)
            if post and (post.is_hidden or post.hidden_by_federation) and not person.full_access:
                continue
            entry.post = post
            visible.append(entry)
        page = visible[offset : offset + limit]
        for entry in page:
            if entry.post is None or not entry.post.photos:
                continue
            entry.photos = [WallPhoto(item, await self._files.url(item)) for item in entry.post.photo_files]
        return page, len(visible)

    async def save(
        self,
        user_id: UUID,
        role: WallRole,
        contest_id: int,
        text: str | None,
        photo_ids: list[UUID],
        is_hidden: bool,
        ip: str | None,
    ) -> WallPostModel:
        """Создаёт или обновляет пост о соревновании: текст, фото и видимость, с проверкой прав и фото."""
        user = await self._people.user(user_id)
        if user is None:
            raise NotFound()
        if Role(role.value) not in page_roles(user):
            raise Forbidden()
        if not any(entry.contest.id == contest_id for entry in await self._feed(user.id, role)):
            raise Forbidden("Этого соревнования нет в вашей ленте")
        post = await self._wall.post(user.id, role, contest_id)
        current = post.photo_files if post else []
        ids = list(dict.fromkeys(photo_ids))
        if len(ids) > self.MAX_PHOTOS:
            raise ValidationFailed(fields={"photo_ids": [f"Не больше {self.MAX_PHOTOS} фото"]})
        items, problem = await self._files.usable(
            ids, user.id, False, Files.IMAGE_TYPES, already_attached=[item.id for item in current]
        )
        if problem:
            message = "Только JPEG, PNG или WebP" if problem == "type" else problem
            raise ValidationFailed(fields={"photo_ids": [message]})
        body = (text or "").strip() or None
        if post is None:
            post = await self._wall.add(
                WallPostModel(user_id=user.id, role=role, contest_id=contest_id, text=body, is_hidden=is_hidden, photos=[])
            )
        else:
            await self._wall.update(post, {"text": body, "is_hidden": is_hidden})
        kept = {item.id for item in items}
        await self._files.set_public([item for item in current if item.id not in kept], False)
        await self._files.set_public(items, True)
        existing = {photo.file_id: photo for photo in post.photos}
        photos = []
        for position, item in enumerate(items):
            photo = existing.get(item.id) or WallPostPhotoModel(file=item)
            photo.position = position
            photos.append(photo)
        await self._wall.update(post, {"photos": photos})
        await self._audit.write(
            AuditAction.WALL_POST_UPDATE,
            user_id=user.id,
            object_type="wall_post",
            object_id=post.id,
            payload={"contest_id": contest_id, "role": role.value, "photos": len(items), "is_hidden": is_hidden},
            ip=ip,
        )
        await self._uow.commit()
        saved = await self._wall.post_by_id(post.id)
        if saved is None:
            raise NotFound()
        return saved

    async def moderate(self, actor_id: UUID, post_id: UUID, hidden: bool, ip: str | None) -> WallPostModel:
        """Скрывает или показывает пост решением федерации."""
        post = await self._wall.post_by_id(post_id)
        if post is None:
            raise NotFound()
        if post.hidden_by_federation != hidden:
            await self._wall.update(post, {"hidden_by_federation": hidden})
            await self._audit.write(
                AuditAction.WALL_POST_MODERATE,
                user_id=actor_id,
                object_type="wall_post",
                object_id=post.id,
                payload={"hidden": hidden, "owner_id": str(post.user_id), "contest_id": post.contest_id},
                ip=ip,
            )
            await self._uow.commit()
        return post

    async def _feed(self, user_id: UUID, role: WallRole) -> list[WallEntry]:
        """Строит ленту соревнований пользователя для роли role: своих, как участника или как тренера."""
        if role == WallRole.ORGANIZER:
            return [WallEntry(item) for item in await self._wall.organized(user_id, self.STATUSES)]
        if role == WallRole.JUDGE:
            return [WallEntry(contest, position=position) for contest, position in await self._wall.judged(user_id, self.STATUSES)]
        if role == WallRole.ATHLETE:
            items = await self._wall.member_applications(user_id, self.STATUSES)
            places = await self._wall.places([item.id for item in items])
            return [
                WallEntry(
                    item.contest,
                    team_name=item.team_name,
                    place=places.get((item.id, user_id)),
                    disqualified=(item.id, user_id) in places and places[(item.id, user_id)] is None,
                )
                for item in items
            ]
        items = await self._wall.coach_applications(user_id, self.STATUSES)
        places = await self._wall.places([item.id for item in items])
        grouped: dict[int, tuple[ContestModel, set[UUID], list[int]]] = {}
        for item in items:
            _, athletes, best = grouped.setdefault(item.contest_id, (item.contest, set(), []))
            for member in item.members:
                if member.is_active:
                    athletes.add(member.user_id)
                    if (place := places.get((item.id, member.user_id))) is not None:
                        best.append(place)
        return [
            WallEntry(contest, athletes=len(athletes), place=min(best) if best else None)
            for contest, athletes, best in grouped.values()
        ]
