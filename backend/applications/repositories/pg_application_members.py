from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contest_application_member import ContestApplicationMemberModel
from infrastructure.enums import Role, RoleStatus
from infrastructure.user import UserModel
from infrastructure.user_role import UserRoleModel

M = ContestApplicationMemberModel


class ApplicationMemberRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add(self, item: ContestApplicationMemberModel) -> ContestApplicationMemberModel:
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(
        self, item: ContestApplicationMemberModel, values: dict[str, Any]
    ) -> ContestApplicationMemberModel:
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item

    async def delete(self, item: ContestApplicationMemberModel) -> None:
        await self._db.delete(item)
        await self._db.flush()

    async def busy_users(
        self, contest_id: int, user_ids: Sequence[UUID], exclude_application_id: int | None
    ) -> set[UUID]:
        if not user_ids:
            return set()
        conditions: list[Any] = [M.contest_id == contest_id, M.user_id.in_(user_ids), M.is_active]
        if exclude_application_id is not None:
            conditions.append(M.application_id != exclude_application_id)
        return set((await self._db.scalars(select(M.user_id).where(*conditions))).all())

    async def users(self, user_ids: Sequence[UUID]) -> dict[UUID, UserModel]:
        if not user_ids:
            return {}
        items = await self._db.scalars(
            select(UserModel).where(UserModel.id.in_(user_ids)).execution_options(populate_existing=True)
        )
        return {item.id: item for item in items.all()}

    async def search_athletes(self, text: str, limit: int) -> Sequence[UserModel]:
        full_name = func.concat_ws(" ", UserModel.last_name, UserModel.first_name, UserModel.middle_name)
        athletes = select(UserRoleModel.user_id).where(
            UserRoleModel.role == Role.ATHLETE, UserRoleModel.status == RoleStatus.VERIFIED
        )
        patterns = [
            "%" + word.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%" for word in text.split()
        ]
        words = [
            or_(full_name.ilike(pattern, escape="!"), UserModel.email.ilike(pattern, escape="!"))
            for pattern in patterns
        ]
        items = await self._db.scalars(
            select(UserModel)
            .where(UserModel.id.in_(athletes), UserModel.is_active, *words)
            .order_by(UserModel.last_name, UserModel.first_name, UserModel.id)
            .limit(limit)
        )
        return items.all()
