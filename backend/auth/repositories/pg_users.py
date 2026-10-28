from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Select, exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.enums import Role, RoleStatus
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel


def _fresh(statement: Select) -> Select:
    """Добавляет к запросу опцию обновления уже закэшированных в сессии объектов."""
    return statement.execution_options(populate_existing=True)


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет зависимость."""
        self._db = db

    async def get(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id."""
        return await self._db.scalar(_fresh(select(UserModel).where(UserModel.id == user_id)))

    async def get_by_email(self, email: str) -> UserModel | None:
        """Возвращает пользователя по email."""
        return await self._db.scalar(_fresh(select(UserModel).where(UserModel.email == email)))

    async def active_federation_ids(self, exclude: UUID) -> list[UUID]:
        """Id активных пользователей с верифицированной ролью федерации, кроме исключённого."""
        return list(await self._db.scalars(select(UserModel.id).join(UserRoleModel, UserRoleModel.user_id == UserModel.id)
            .where(UserModel.is_active.is_(True), UserModel.id != exclude,
                   UserRoleModel.role == Role.FEDERATION, UserRoleModel.status == RoleStatus.VERIFIED).distinct()))

    async def email_exists(self, email: str) -> bool:
        """True, если пользователь с такой почтой уже есть."""
        return bool(await self._db.scalar(select(exists().where(UserModel.email == email))))

    async def create(
        self,
        email: str,
        password_hash: str,
        last_name: str,
        first_name: str,
        middle_name: str | None,
        birth_date: date,
        pd_consent_version: str,
        pd_consent_at: datetime,
        roles: list[tuple[Role, RoleStatus]],
    ) -> UserModel:
        """Создаёт пользователя вместе с его ролями."""
        model = UserModel(
            email=email,
            password_hash=password_hash,
            last_name=last_name,
            first_name=first_name,
            middle_name=middle_name,
            birth_date=birth_date,
            pd_consent_version=pd_consent_version,
            pd_consent_at=pd_consent_at,
            roles=[UserRoleModel(role=role, status=status, created_at=pd_consent_at) for role, status in roles],
        )
        self._db.add(model)
        await self._db.flush()
        await self._db.refresh(model, ["roles"])
        return model

    async def set_password_hash(self, user_id: UUID, password_hash: str) -> None:
        """Обновляет хэш пароля пользователя."""
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(password_hash=password_hash))

    async def set_email(self, user_id: UUID, email: str, verified_at: datetime) -> None:
        """Меняет почту пользователя и сразу отмечает её подтверждённой."""
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(
            email=email, email_verified_at=verified_at))

    async def set_email_verified(self, user_id: UUID, at: datetime) -> None:
        """Отмечает почту подтверждённой, если она ещё не была подтверждена."""
        await self._db.execute(update(UserModel).where(UserModel.id == user_id, UserModel.email_verified_at.is_(None))
                               .values(email_verified_at=at))

    async def set_last_login(self, user_id: UUID, at: datetime) -> None:
        """Обновляет время последнего входа пользователя."""
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(last_login_at=at))

    async def academic_group_exists(self, group_id: int) -> bool:
        """True, если учебная группа с таким id существует и не архивирована."""
        return bool(
            await self._db.scalar(
                select(
                    exists().where(
                        DictionaryAcademicGroupModel.id == group_id, DictionaryAcademicGroupModel.is_archived.is_(False)
                    )
                )
            )
        )

    async def update_profile(self, user_id: UUID, values: dict[str, Any]) -> None:
        """Обновляет переданные поля профиля пользователя."""
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(**values))

    async def set_academic_group(self, user_id: UUID, group_id: int | None) -> None:
        """Устанавливает учебную группу пользователя."""
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(academic_group_id=group_id))
