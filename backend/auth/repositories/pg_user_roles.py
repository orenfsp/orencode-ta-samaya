from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from infrastructure.enums import Role, RoleStatus
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel


@dataclass(frozen=True)
class RoleRequestQuery:
    statuses: frozenset[RoleStatus]
    roles: frozenset[Role]
    search: str | None = None


class UserRoleRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет зависимость."""
        self._db = db

    async def find(self, user_id: UUID, role: Role) -> UserRoleModel | None:
        """Возвращает заявку пользователя на роль, если она есть."""
        return await self._db.scalar(
            select(UserRoleModel).where(UserRoleModel.user_id == user_id, UserRoleModel.role == role)
        )

    async def add(self, user_id: UUID, role: Role, status: RoleStatus, at: datetime) -> None:
        """Создаёт новую заявку на роль."""
        self._db.add(UserRoleModel(user_id=user_id, role=role, status=status, created_at=at))
        await self._db.flush()

    async def reopen(self, role_id: UUID, at: datetime) -> None:
        """Переоткрывает отклонённую заявку, сбрасывая решение и дату создания."""
        await self._db.execute(
            update(UserRoleModel)
            .where(UserRoleModel.id == role_id)
            .values(status=RoleStatus.PENDING, reject_reason=None, decided_by=None, decided_at=None, created_at=at)
        )

    async def reset(self, role_id: UUID) -> None:
        """Возвращает заявку в состояние ожидания, сбрасывая решение."""
        await self._db.execute(
            update(UserRoleModel)
            .where(UserRoleModel.id == role_id)
            .values(status=RoleStatus.PENDING, reject_reason=None, decided_by=None, decided_at=None)
        )

    async def mark_onboarding(self, user_id: UUID, role: Role) -> bool:
        """Отмечает онбординг пройденным; False, если заявки на роль не нашлось."""
        result = await self._db.execute(
            update(UserRoleModel)
            .where(UserRoleModel.user_id == user_id, UserRoleModel.role == role)
            .values(onboarding_done=True)
        )
        return result.rowcount > 0

    async def lock(self, role_id: UUID) -> UserRoleModel | None:
        """Блокирует строку заявки на роль построчной блокировкой для последующего изменения."""
        return await self._db.scalar(
            select(UserRoleModel).where(UserRoleModel.id == role_id).with_for_update().execution_options(
                populate_existing=True
            )
        )

    async def decide(
        self,
        role_id: UUID,
        status: RoleStatus,
        reject_reason: str | None,
        decided_by: UUID,
        at: datetime,
    ) -> None:
        """Записывает решение по заявке на роль."""
        await self._db.execute(
            update(UserRoleModel)
            .where(UserRoleModel.id == role_id)
            .values(status=status, reject_reason=reject_reason, decided_by=decided_by, decided_at=at)
        )

    async def get_request(self, role_id: UUID) -> UserRoleModel | None:
        """Возвращает заявку на роль вместе с пользователем и решившим её модератором."""
        return await self._db.scalar(
            select(UserRoleModel)
            .where(UserRoleModel.id == role_id)
            .options(joinedload(UserRoleModel.user), joinedload(UserRoleModel.decider))
            .execution_options(populate_existing=True)
        )

    async def list_requests(
        self, query: RoleRequestQuery, limit: int, offset: int
    ) -> tuple[list[UserRoleModel], int]:
        """Страница заявок на роли по фильтрам статуса, роли и поиска по имени или почте, с общим количеством."""
        conditions = [UserRoleModel.status.in_(query.statuses), UserRoleModel.role.in_(query.roles)]
        if query.search:
            pattern = f"%{query.search}%"
            full_name = func.concat_ws(" ", UserModel.last_name, UserModel.first_name, UserModel.middle_name)
            conditions.append(
                UserRoleModel.user_id.in_(
                    select(UserModel.id).where(or_(full_name.ilike(pattern), UserModel.email.ilike(pattern)))
                )
            )
        total = await self._db.scalar(select(func.count()).select_from(UserRoleModel).where(*conditions))
        models = await self._db.scalars(
            select(UserRoleModel)
            .where(*conditions)
            .options(joinedload(UserRoleModel.user), joinedload(UserRoleModel.decider))
            .order_by(
                case((UserRoleModel.status == RoleStatus.PENDING, 0), else_=1),
                UserRoleModel.decided_at.desc().nulls_first(),
                UserRoleModel.created_at.asc(),
                UserRoleModel.id,
            )
            .limit(limit)
            .offset(offset)
        )
        return list(models.unique()), total or 0

    async def count_by_role(self, status: RoleStatus, roles: frozenset[Role]) -> dict[Role, int]:
        """Количество заявок с данным статусом по каждой из перечисленных ролей."""
        rows = await self._db.execute(
            select(UserRoleModel.role, func.count())
            .where(UserRoleModel.status == status, UserRoleModel.role.in_(roles))
            .group_by(UserRoleModel.role)
        )
        counts = dict.fromkeys(roles, 0)
        counts.update({role: total for role, total in rows.tuples()})
        return counts
