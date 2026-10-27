from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Select, exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.enums import Role, RoleStatus
from infrastructure.user import UserModel
from infrastructure.user_role import UserRoleModel


def _fresh(statement: Select) -> Select:
    return statement.execution_options(populate_existing=True)


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get(self, user_id: UUID) -> UserModel | None:
        return await self._db.scalar(_fresh(select(UserModel).where(UserModel.id == user_id)))

    async def get_by_email(self, email: str) -> UserModel | None:
        return await self._db.scalar(_fresh(select(UserModel).where(UserModel.email == email)))

    async def email_exists(self, email: str) -> bool:
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
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(password_hash=password_hash))

    async def set_last_login(self, user_id: UUID, at: datetime) -> None:
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(last_login_at=at))

    async def academic_group_exists(self, group_id: int) -> bool:
        return bool(
            await self._db.scalar(
                select(
                    exists().where(
                        DictionaryAcademicGroupModel.id == group_id, DictionaryAcademicGroupModel.is_archived.is_(False)
                    )
                )
            )
        )

    async def set_academic_group(self, user_id: UUID, group_id: int | None) -> None:
        await self._db.execute(update(UserModel).where(UserModel.id == user_id).values(academic_group_id=group_id))
