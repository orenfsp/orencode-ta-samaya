from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from contests.repositories.pg_contests import ContestRepository
from core.database import UnitOfWork
from core.errors import AppError, Forbidden, InvalidStatus, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from infrastructure.contests.contest import ContestModel
from infrastructure.dictionaries.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.enums import ContestStatus, QualificationKind, Role, RoleStatus
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.account.user import UserModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T
from qualifications.repositories.pg_judge_assignments import JudgeAssignmentRepository
from qualifications.repositories.pg_qualifications import QualificationRepository

CLOSED = frozenset({ContestStatus.COMPLETED, ContestStatus.ARCHIVED, ContestStatus.CANCELLED})


class CategoryNotValid(AppError):
    status_code = 409
    code = "category_not_valid"
    message = "У судьи нет категории, действующей на дату соревнования"


class AlreadyAssigned(AppError):
    status_code = 409
    code = "already_assigned"
    message = "Судья уже в коллегии этого соревнования"


@dataclass(frozen=True, slots=True)
class Candidate:
    user: UserModel
    category: QualificationModel | None


class Judges:
    """Управляет судейскими коллегиями соревнований: назначение, смена должности, снятие."""

    def __init__(
        self,
        uow: UnitOfWork,
        assignments: JudgeAssignmentRepository,
        qualifications: QualificationRepository,
        contests: ContestRepository,
        users: UserRepository,
        dictionary: DictionaryRepository,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._assignments, self._qualifications = uow, assignments, qualifications
        self._contests, self._users, self._dictionary = contests, users, dictionary
        self._audit, self._notifications = audit, notifications

    async def of_contest(self, contest_id: int) -> tuple[ContestModel, Sequence[JudgeAssignmentModel], dict[UUID, QualificationModel]]:
        """Возвращает соревнование, его коллегию судей и их действующие судейские категории."""
        contest = await self._contest(contest_id)
        items = await self._assignments.of_contest(contest_id)
        categories = await self._qualifications.valid_on(
            [item.judge_id for item in items], QualificationKind.JUDGE_CATEGORY, contest.starts_on
        )
        return contest, items, categories

    async def of_judge(self, judge_id: UUID) -> Sequence[JudgeAssignmentModel]:
        """Возвращает назначения судьи на соревнования."""
        return await self._assignments.of_judge(judge_id)

    async def candidates(self, actor_id: UUID, roles: frozenset[Role], contest_id: int, q: str | None) -> list[Candidate]:
        """Подбирает ещё не назначенных судей для соревнования, судей без категории — в конец списка."""
        contest = await self._manageable(actor_id, roles, contest_id)
        users = await self._qualifications.judges(q)
        categories = await self._qualifications.valid_on(
            [user.id for user in users], QualificationKind.JUDGE_CATEGORY, contest.starts_on
        )
        taken = {item.judge_id for item in await self._assignments.of_contest(contest_id)}
        found = [Candidate(user, categories.get(user.id)) for user in users if user.id not in taken]
        return sorted(found, key=lambda item: item.category is None)

    async def assign(
        self, actor_id: UUID, roles: frozenset[Role], contest_id: int, judge_id: UUID, position_id: int, ip: str | None
    ) -> JudgeAssignmentModel:
        """Назначает судью в коллегию соревнования, проверяя роль, повтор назначения и действующую категорию."""
        contest = await self._manageable(actor_id, roles, contest_id)
        position = await self._position(position_id)
        judge = await self._users.get(judge_id)
        if judge is None or not judge.is_active or not any(
            r.role == Role.JUDGE and r.status == RoleStatus.VERIFIED for r in judge.roles
        ):
            raise ValidationFailed(fields={"judge_id": ["Выберите судью с подтверждённой ролью"]})
        if await self._assignments.find(contest_id, judge_id):
            raise AlreadyAssigned()
        valid = await self._qualifications.valid_on([judge_id], QualificationKind.JUDGE_CATEGORY, contest.starts_on)
        if judge_id not in valid:
            raise CategoryNotValid()
        item = await self._assignments.add(
            JudgeAssignmentModel(contest_id=contest_id, judge_id=judge_id, position_id=position.id, assigned_by=actor_id)
        )
        await self._audit.write(
            AuditAction.JUDGE_ASSIGN, actor_id, "judge_assignment", item.id,
            {"contest_id": contest_id, "judge_id": str(judge_id), "position": position.name}, ip,
        )
        await self._notifications.judge_assignment(judge_id, actor_id, T.JUDGE_ASSIGNED, contest.title, position.name)
        await self._uow.commit()
        return item

    async def update(
        self, actor_id: UUID, roles: frozenset[Role], contest_id: int, assignment_id: UUID, position_id: int, ip: str | None
    ) -> JudgeAssignmentModel:
        """Меняет должность судьи в коллегии соревнования."""
        contest = await self._manageable(actor_id, roles, contest_id)
        item = await self._assignment(contest_id, assignment_id)
        position = await self._position(position_id)
        item.position_id = position.id
        await self._assignments.flush()
        await self._audit.write(
            AuditAction.JUDGE_UPDATE, actor_id, "judge_assignment", item.id,
            {"contest_id": contest_id, "position": position.name}, ip,
        )
        await self._notifications.judge_assignment(item.judge_id, actor_id, T.JUDGE_ASSIGNED, contest.title, position.name)
        await self._uow.commit()
        return (await self._assignments.get(item.id)) or item

    async def remove(
        self, actor_id: UUID, roles: frozenset[Role], contest_id: int, assignment_id: UUID, ip: str | None
    ) -> None:
        """Убирает судью из коллегии соревнования."""
        contest = await self._manageable(actor_id, roles, contest_id)
        item = await self._assignment(contest_id, assignment_id)
        judge_id, position = item.judge_id, item.position.name
        await self._assignments.remove(item, actor_id, datetime.now(UTC))
        await self._audit.write(
            AuditAction.JUDGE_REMOVE, actor_id, "judge_assignment", assignment_id,
            {"contest_id": contest_id, "judge_id": str(judge_id)}, ip,
        )
        await self._notifications.judge_assignment(judge_id, actor_id, T.JUDGE_REMOVED, contest.title, position)
        await self._uow.commit()

    async def _contest(self, contest_id: int) -> ContestModel:
        """Возвращает соревнование по id или поднимает NotFound."""
        contest = await self._contests.get(contest_id)
        if contest is None:
            raise NotFound("Соревнование не найдено")
        return contest

    async def _manageable(self, actor_id: UUID, roles: frozenset[Role], contest_id: int) -> ContestModel:
        """Возвращает соревнование, проверяя право actor управлять коллегией и что оно ещё не закрыто."""
        contest = await self._contest(contest_id)
        if Role.FEDERATION not in roles and not (Role.ORGANIZER in roles and contest.organizer_id == actor_id):
            raise Forbidden("Коллегию назначает организатор соревнования или федерация")
        if contest.status in CLOSED:
            raise InvalidStatus("Соревнование завершено или отменено")
        return contest

    async def _position(self, position_id: int) -> DictionaryJudgePositionModel:
        """Возвращает действующую судейскую должность по id."""
        position = await self._dictionary.get(DictionaryJudgePositionModel, position_id)
        if position is None or position.is_archived:
            raise ValidationFailed(fields={"position_id": ["Выберите должность"]})
        return position

    async def _assignment(self, contest_id: int, assignment_id: UUID) -> JudgeAssignmentModel:
        """Возвращает назначение судьи на соревнование, проверяя принадлежность соревнованию."""
        item = await self._assignments.get(assignment_id)
        if item is None or item.contest_id != contest_id or item.removed_at is not None:
            raise NotFound()
        return item
