from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.sport.athlete_profile import AthleteProfileModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.enums import CoachLinkStatus, Role, RoleStatus
from infrastructure.account.user import UserModel
from infrastructure.account.user_role import UserRoleModel

L = CoachLinkModel
OPEN = (CoachLinkStatus.REQUESTED, CoachLinkStatus.ACTIVE, CoachLinkStatus.SUSPENDED)


class CoachLinkRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def get(self, link_id: UUID) -> CoachLinkModel | None:
        """Возвращает связь по id или None."""
        return await self._db.get(L, link_id)

    async def open_link(self, coach_id: UUID, athlete_id: UUID, discipline_id: int) -> CoachLinkModel | None:
        """Возвращает незакрытую связь тренера и спортсмена по дисциплине или None."""
        return await self._db.scalar(
            select(L).where(L.coach_id == coach_id, L.athlete_id == athlete_id, L.discipline_id == discipline_id,
                            L.status.in_(OPEN))
        )

    async def of_coach(self, coach_id: UUID) -> Sequence[CoachLinkModel]:
        """Возвращает связи тренера, свежие первыми."""
        return (await self._db.scalars(select(L).where(L.coach_id == coach_id).order_by(L.updated_at.desc()))).all()

    async def of_athlete(self, athlete_id: UUID) -> Sequence[CoachLinkModel]:
        """Возвращает связи спортсмена, свежие первыми."""
        return (await self._db.scalars(select(L).where(L.athlete_id == athlete_id).order_by(L.updated_at.desc()))).all()

    async def active_athlete_ids(self, coach_id: UUID) -> set[UUID]:
        """Возвращает id спортсменов с активной связью у тренера."""
        rows = await self._db.scalars(
            select(L.athlete_id).where(L.coach_id == coach_id, L.status == CoachLinkStatus.ACTIVE)
        )
        return set(rows.all())

    async def athletes(self, q: str | None, exclude: UUID) -> Sequence[UserModel]:
        """Ищет спортсменов с подтверждённой ролью по ФИО или почте."""
        query = (
            select(UserModel)
            .join(UserRoleModel, UserRoleModel.user_id == UserModel.id)
            .outerjoin(AthleteProfileModel, AthleteProfileModel.user_id == UserModel.id)
            .where(UserRoleModel.role == Role.ATHLETE, UserRoleModel.status == RoleStatus.VERIFIED,
                   UserModel.is_active, UserModel.id != exclude)
        )
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            query = query.where(or_(UserModel.last_name.ilike(pattern), UserModel.first_name.ilike(pattern)))
        return (await self._db.scalars(query.order_by(UserModel.last_name, UserModel.first_name).limit(30))).all()

    async def add(self, item: CoachLinkModel) -> CoachLinkModel:
        """Добавляет связь и возвращает её с id."""
        self._db.add(item)
        await self._db.flush()
        await self._db.refresh(item)
        return item

    async def refresh(self, item: CoachLinkModel) -> CoachLinkModel:
        """Перечитывает связь вместе с историей."""
        await self._db.refresh(item)
        return item

    async def flush(self) -> None:
        """Отправляет накопленные изменения в БД."""
        await self._db.flush()
