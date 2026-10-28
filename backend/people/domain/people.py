from dataclasses import dataclass
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from consents.domain.consents import is_minor
from core.errors import NotFound, ValidationFailed
from files.domain.files import Files
from infrastructure.enums import Role, RoleStatus
from infrastructure.account.user import UserModel
from people.repositories.pg_people import PersonRepository

PAGE_ROLES = (Role.ATHLETE, Role.COACH, Role.JUDGE, Role.ORGANIZER)
UNSET = object()


def full_name(user: UserModel) -> str:
    """Собирает полное имя пользователя из фамилии, имени и отчества."""
    return " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)


def short_name(user: UserModel) -> str:
    """Собирает короткое имя вида «Имя Ф.»."""
    return f"{user.first_name} {user.last_name[:1]}."


def page_roles(user: UserModel) -> list[Role]:
    """Возвращает подтверждённые роли страницы пользователя; федерации также даёт роль организатора."""
    granted = {item.role for item in user.roles if item.status == RoleStatus.VERIFIED}
    if Role.FEDERATION in granted:
        granted.add(Role.ORGANIZER)
    return [role for role in PAGE_ROLES if role in granted]


@dataclass(frozen=True, slots=True)
class Viewer:
    id: UUID | None
    is_federation: bool


@dataclass(frozen=True, slots=True)
class Person:
    user: UserModel
    roles: list[Role]
    is_owner: bool
    full_access: bool
    masked: bool
    avatar_url: str | None


class People:
    """Отдаёт страницы пользователей и управляет их настройками. Страницы открыты всем, у несовершеннолетних посторонним — маска."""

    def __init__(
        self, uow: UnitOfWork, people: PersonRepository, files: Files, audit: Audit
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._people = people
        self._files = files
        self._audit = audit

    async def get(self, viewer: Viewer, user_id: UUID) -> Person:
        """Возвращает страницу пользователя; несовершеннолетнего посторонний видит без фамилии, даты рождения и фото."""
        user = await self._people.user(user_id)
        if user is None or not user.is_active:
            raise NotFound()
        is_owner = viewer.id == user.id
        full_access = is_owner or viewer.is_federation
        roles = page_roles(user)
        if not roles and not full_access:
            raise NotFound()
        masked = not full_access and user.birth_date is not None and is_minor(user.birth_date)
        avatar_url = await self._files.url(user.avatar) if user.avatar and not masked else None
        return Person(user, roles, is_owner, full_access, masked, avatar_url)

    async def avatar(self, viewer: Viewer, user_id: UUID) -> str:
        """Ссылка на фото человека; NotFound, если фото нет или это несовершеннолетний, а смотрит посторонний."""
        user = await self._people.user(user_id)
        if user is None or not user.is_active or user.avatar is None:
            raise NotFound()
        if viewer.id != user.id and not viewer.is_federation and user.birth_date and is_minor(user.birth_date):
            raise NotFound()
        return await self._files.url(user.avatar)

    async def update_page(
        self,
        user_id: UUID,
        avatar_file_id: UUID | None | object,
        ip: str | None,
    ) -> Person:
        """Обновляет аватар пользователя, пишет аудит и возвращает актуальную страницу."""
        user = await self._people.user(user_id)
        if user is None:
            raise NotFound()
        values: dict[str, object] = {}
        if avatar_file_id is not UNSET and avatar_file_id != user.avatar_file_id:
            if user.avatar is not None:
                await self._files.set_public([user.avatar], False)
            if isinstance(avatar_file_id, UUID):
                items, problem = await self._files.usable([avatar_file_id], user.id, False, Files.IMAGE_TYPES)
                if problem:
                    message = "Аватар — только JPEG, PNG или WebP" if problem == "type" else problem
                    raise ValidationFailed(fields={"avatar_file_id": [message]})
                await self._files.set_public(items, True)
            values["avatar_file_id"] = avatar_file_id
        if values:
            await self._people.update(user, values)
            await self._audit.write(
                AuditAction.PERSON_PAGE_UPDATE,
                user_id=user.id,
                object_type="person_page",
                object_id=user.id,
                payload={key: str(value) if value is not None else None for key, value in values.items()},
                ip=ip,
            )
            await self._uow.commit()
        return await self.get(Viewer(user.id, False), user.id)
