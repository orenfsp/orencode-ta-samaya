from collections.abc import Collection, Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.contests.contest import ContestModel
from infrastructure.dictionaries.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_application_member import ContestApplicationMemberModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus, ContestStatus, MemberConfirmation, WallRole
from infrastructure.account.wall_post import WallPostModel

A = ContestApplicationModel
M = ContestApplicationMemberModel
P = WallPostModel


def _fresh(statement: Select) -> Select:
    """Добавляет к запросу опцию обновления уже загруженных в сессии объектов."""
    return statement.execution_options(populate_existing=True)


class WallRepository:
    """Доступ к заявкам, результатам и постам стены для построения ленты."""

    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def places(self, application_ids: Collection[int]) -> dict[tuple[int, UUID], int | None]:
        """Возвращает места участников по заявкам, если такие заявки указаны."""
        if not application_ids:
            return {}
        rows = await self._db.execute(
            select(ContestResultModel.application_id, ContestResultModel.user_id, ContestResultModel.place).where(
                ContestResultModel.application_id.in_(application_ids)
            )
        )
        return {(application_id, user_id): place for application_id, user_id, place in rows.tuples()}

    async def member_applications(
        self, user_id: UUID, statuses: Collection[ContestStatus]
    ) -> Sequence[ContestApplicationModel]:
        """Возвращает одобренные заявки, где пользователь активный подтверждённый член, по статусам соревнований."""
        member_of = select(M.application_id).where(
            M.user_id == user_id, M.is_active, M.confirmation != MemberConfirmation.DECLINED
        )
        items = await self._db.scalars(
            select(A)
            .join(ContestModel, ContestModel.id == A.contest_id)
            .where(A.id.in_(member_of), A.status == ApplicationStatus.APPROVED, ContestModel.status.in_(statuses))
            .order_by(ContestModel.starts_on.desc(), ContestModel.id.desc())
        )
        return items.all()

    async def coach_applications(
        self, user_id: UUID, statuses: Collection[ContestStatus]
    ) -> Sequence[ContestApplicationModel]:
        """Возвращает одобренные заявки, созданные пользователем как тренером, по статусам соревнований."""
        items = await self._db.scalars(
            select(A)
            .join(ContestModel, ContestModel.id == A.contest_id)
            .where(
                A.created_by == user_id,
                A.created_as == ApplicationCreator.COACH,
                A.status == ApplicationStatus.APPROVED,
                ContestModel.status.in_(statuses),
            )
            .order_by(ContestModel.starts_on.desc(), ContestModel.id.desc(), A.id)
        )
        return items.all()

    async def organized(self, user_id: UUID, statuses: Collection[ContestStatus]) -> Sequence[ContestModel]:
        """Возвращает соревнования, организованные пользователем, по статусам."""
        items = await self._db.scalars(
            select(ContestModel)
            .where(ContestModel.organizer_id == user_id, ContestModel.status.in_(statuses))
            .order_by(ContestModel.starts_on.desc(), ContestModel.id.desc())
        )
        return items.all()

    async def judged(
        self, user_id: UUID, statuses: Collection[ContestStatus]
    ) -> Sequence[tuple[ContestModel, str]]:
        """Возвращает соревнования, где человек действующий судья, с его должностью; новые сначала."""
        rows = await self._db.execute(
            select(ContestModel, DictionaryJudgePositionModel.name)
            .join(JudgeAssignmentModel, JudgeAssignmentModel.contest_id == ContestModel.id)
            .join(DictionaryJudgePositionModel, DictionaryJudgePositionModel.id == JudgeAssignmentModel.position_id)
            .where(
                JudgeAssignmentModel.judge_id == user_id,
                JudgeAssignmentModel.removed_at.is_(None),
                ContestModel.status.in_(statuses),
            )
            .order_by(ContestModel.starts_on.desc(), ContestModel.id.desc())
        )
        return [(contest, position) for contest, position in rows.tuples()]

    async def posts(self, user_id: UUID, role: WallRole) -> dict[int, WallPostModel]:
        """Возвращает посты пользователя в роли role, сгруппированные по id соревнования."""
        items = await self._db.scalars(_fresh(select(P).where(P.user_id == user_id, P.role == role)))
        return {item.contest_id: item for item in items.all()}

    async def post(self, user_id: UUID, role: WallRole, contest_id: int) -> WallPostModel | None:
        """Возвращает пост пользователя о конкретном соревновании в данной роли."""
        return await self._db.scalar(
            _fresh(select(P).where(P.user_id == user_id, P.role == role, P.contest_id == contest_id))
        )

    async def post_by_id(self, post_id: UUID) -> WallPostModel | None:
        """Возвращает пост по id."""
        return await self._db.scalar(_fresh(select(P).where(P.id == post_id)))

    async def add(self, item: WallPostModel) -> WallPostModel:
        """Сохраняет новый пост."""
        self._db.add(item)
        await self._db.flush()
        return item

    async def update(self, item: WallPostModel, values: dict[str, Any]) -> WallPostModel:
        """Обновляет поля поста значениями values."""
        for name, value in values.items():
            setattr(item, name, value)
        await self._db.flush()
        return item
