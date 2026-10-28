from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.enums import ConsentStatus
from infrastructure.account.guardian_consent import GuardianConsentModel
from infrastructure.account.user import UserModel

C = GuardianConsentModel


def _fresh(statement: Select) -> Select:
    """Добавляет к запросу опцию обновления уже закэшированных в сессии объектов."""
    return statement.execution_options(populate_existing=True)


class ConsentRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет зависимость."""
        self._db = db

    async def for_user(self, user_id: UUID) -> GuardianConsentModel | None:
        """Возвращает согласие пользователя, если оно подано."""
        return await self._db.scalar(_fresh(select(C).where(C.user_id == user_id)))

    async def lock(self, consent_id: UUID) -> GuardianConsentModel | None:
        """Блокирует строку согласия построчной блокировкой для последующего изменения."""
        return await self._db.scalar(_fresh(select(C).where(C.id == consent_id).with_for_update()))

    async def add(self, item: GuardianConsentModel) -> GuardianConsentModel:
        """Добавляет новое согласие."""
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(self, item: GuardianConsentModel, values: dict[str, Any]) -> GuardianConsentModel:
        """Обновляет переданные поля согласия."""
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item

    async def user(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя по id."""
        return await self._db.scalar(_fresh(select(UserModel).where(UserModel.id == user_id)))

    async def list(
        self, status: ConsentStatus | None, search: str | None, limit: int, offset: int
    ) -> tuple[Sequence[tuple[GuardianConsentModel, UserModel]], int]:
        """Страница согласий с пользователями по фильтрам статуса и поиска, с общим количеством."""
        conditions: list[Any] = []
        if status is not None:
            conditions.append(C.status == status)
        if search:
            full_name = func.concat_ws(" ", UserModel.last_name, UserModel.first_name, UserModel.middle_name)
            conditions.append(
                or_(
                    full_name.icontains(search, autoescape=True),
                    UserModel.email.icontains(search, autoescape=True),
                    C.guardian_name.icontains(search, autoescape=True),
                )
            )
        joined = select(C, UserModel).join(UserModel, UserModel.id == C.user_id).where(*conditions)
        total = await self._db.scalar(select(func.count()).select_from(joined.subquery()))
        pending_first = (C.status == ConsentStatus.PENDING).desc()
        rows = await self._db.execute(
            joined.order_by(pending_first, C.submitted_at.desc(), C.id).limit(limit).offset(offset)
        )
        return [(row[0], row[1]) for row in rows], total or 0

    async def pending_count(self) -> int:
        """Количество согласий в ожидании."""
        return int(await self._db.scalar(select(func.count()).select_from(C).where(C.status == ConsentStatus.PENDING)) or 0)
