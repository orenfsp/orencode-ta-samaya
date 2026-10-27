from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from applications.domain.eligibility import Eligibility
from applications.repositories.pg_application_members import ApplicationMemberRepository
from applications.repositories.pg_applications import ApplicationQuery, ApplicationRepository
from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.database import UnitOfWork
from core.errors import Forbidden, InvalidStatus, NameTaken, NotFound, RegistrationClosed, ValidationFailed
from dictionaries.domain.dictionaries import Dictionary
from infrastructure.contest import ContestModel
from infrastructure.contest_application import ContestApplicationModel
from infrastructure.contest_application_member import ContestApplicationMemberModel
from infrastructure.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import (
    ApplicationCreator,
    ApplicationStatus,
    ContestStatus,
    MemberConfirmation,
    ParticipationType,
    Role,
)
from infrastructure.user import UserModel

S = ApplicationStatus
C = MemberConfirmation
CS = ContestStatus


def _now() -> datetime:
    return datetime.now(UTC)


def _name(user: UserModel) -> str:
    return " ".join(part for part in (user.last_name, user.first_name) if part)


class Applications:
    SEARCH_LIMIT = 20
    BEFORE_START = frozenset({CS.PUBLISHED, CS.REGISTRATION_OPEN, CS.REGISTRATION_CLOSED})
    MODERATION = frozenset({CS.REGISTRATION_OPEN, CS.REGISTRATION_CLOSED})
    PUBLIC = frozenset(set(CS) - {CS.DRAFT, CS.ARCHIVED})
    CHANGEABLE = frozenset({S.FORMING, S.SUBMITTED, S.APPROVED})
    MODERATION_LIST = frozenset({S.FORMING, S.SUBMITTED, S.APPROVED, S.REJECTED})

    def __init__(
        self,
        uow: UnitOfWork,
        applications: ApplicationRepository,
        members: ApplicationMemberRepository,
        contests: ContestRepository,
        dictionary: Dictionary,
        audit: Audit,
    ) -> None:
        self._uow = uow
        self._applications = applications
        self._members = members
        self._contests = contests
        self._dictionary = dictionary
        self._audit = audit

    async def search_athletes(
        self, text: str, contest_id: int | None
    ) -> tuple[Sequence[UserModel], dict[UUID, list[str]]]:
        users = await self._members.search_athletes(text.strip(), self.SEARCH_LIMIT)
        problems: dict[UUID, list[str]] = {}
        if contest_id is not None:
            contest = await self._public_contest(contest_id)
            busy = await self._members.busy_users(contest.id, [user.id for user in users], None)
            for user in users:
                found = Eligibility.problems(user, contest)
                if user.id in busy:
                    found.append("уже заявлен на это соревнование")
                problems[user.id] = found
        return users, problems

    async def available(
        self, user_id: UUID, roles: frozenset[Role], as_: ApplicationCreator
    ) -> list[tuple[ContestModel, list[str]]]:
        if Role(as_.value) not in roles:
            raise Forbidden()
        user = await self._user(user_id)
        as_athlete = as_ == ApplicationCreator.ATHLETE
        contests = await self._applications.open_contests(_now(), user.id if as_athlete else None)
        return [(item, Eligibility.problems(user, item) if as_athlete else []) for item in contests]

    async def mine(self, user_id: UUID, as_: ApplicationCreator) -> Sequence[ContestApplicationModel]:
        if as_ == ApplicationCreator.COACH:
            return await self._applications.list_for_coach(user_id)
        return await self._applications.list_for_member(user_id)

    async def get(self, user_id: UUID, roles: frozenset[Role], application_id: int) -> ContestApplicationModel:
        item = await self._applications.get(application_id)
        if item is None or not self._can_see(item, user_id, roles):
            raise NotFound()
        return item

    async def participants(self, contest_id: int) -> Sequence[ContestApplicationModel]:
        contest = await self._public_contest(contest_id)
        return await self._applications.list_approved(contest.id)

    async def create(
        self,
        user_id: UUID,
        roles: frozenset[Role],
        contest_id: int,
        as_: ApplicationCreator,
        team_name: str | None,
        member_ids: list[UUID],
        captain_id: UUID | None,
        ip: str | None,
    ) -> ContestApplicationModel:
        if Role(as_.value) not in roles:
            raise Forbidden()
        user = await self._user(user_id)
        contest = await self._contests.lock(contest_id)
        if contest is None or contest.status not in self.PUBLIC:
            raise NotFound()
        self._ensure_registration(contest)
        team = contest.participation_type == ParticipationType.TEAM
        ids = list(dict.fromkeys(member_ids))
        errors: dict[str, list[str]] = {}
        if as_ == ApplicationCreator.ATHLETE:
            if user.id in ids:
                ids.remove(user.id)
            if not team and ids:
                errors["member_ids"] = ["В личной заявке участвуете только вы"]
            ids = [user.id, *ids]
            captain_id = user.id if team else None
        else:
            if user.id in ids:
                errors["member_ids"] = ["Тренер не входит в состав заявки"]
            if not ids:
                errors["member_ids"] = ["Выберите спортсменов"]
            elif not team and len(ids) > 1:
                errors["member_ids"] = ["В личной заявке один спортсмен"]
            if captain_id is not None and captain_id not in ids:
                errors["captain_id"] = ["Капитан должен быть в составе"]
        if team and not team_name:
            errors["team_name"] = ["Укажите название команды"]
        if not team:
            team_name = None
        size = Eligibility.team_size_problem(contest, len(ids), final=False)
        if size:
            errors.setdefault("member_ids", [size])
        if team_name and await self._applications.team_name_taken(contest.id, team_name, None):
            errors["team_name"] = ["Команда с таким названием уже заявлена"]
        users = await self._check_people(contest, ids, None, user.id, errors)
        if errors:
            raise ValidationFailed(fields=errors)
        instant = as_ == ApplicationCreator.ATHLETE and not team
        now = _now()
        item = await self._applications.add(
            ContestApplicationModel(
                contest_id=contest.id,
                team_name=team_name,
                created_by=user.id,
                created_as=as_,
                status=S.SUBMITTED if instant else S.FORMING,
                submitted_at=now if instant else None,
            )
        )
        catalog = await self._age_catalog()
        for member_id in ids:
            own = as_ == ApplicationCreator.ATHLETE and member_id == user.id
            member = users[member_id]
            await self._members.add(
                ContestApplicationMemberModel(
                    application_id=item.id,
                    contest_id=contest.id,
                    user_id=member_id,
                    is_captain=member_id == captain_id,
                    confirmation=C.CONFIRMED if own else C.INVITED,
                    is_active=True,
                    responded_at=now if own else None,
                    age_group_id=self._age_group_id(member, contest, catalog) if instant else None,
                    academic_group_id=member.academic_group_id if instant else None,
                )
            )
        await self._write(AuditAction.APPLICATION_CREATE, item, user.id, ip, {"members": [str(i) for i in ids]})
        await self._uow.commit()
        return await self._reload(item.id)

    async def create_for_athletes(
        self, user_id: UUID, roles: frozenset[Role], contest_id: int, member_ids: list[UUID], ip: str | None
    ) -> list[ContestApplicationModel]:
        if Role.COACH not in roles:
            raise Forbidden()
        contest = await self._contests.lock(contest_id)
        if contest is None or contest.status not in self.PUBLIC:
            raise NotFound()
        self._ensure_registration(contest)
        if contest.participation_type != ParticipationType.INDIVIDUAL:
            raise InvalidStatus()
        ids = list(dict.fromkeys(member_ids))
        errors: dict[str, list[str]] = {}
        if user_id in ids:
            errors["member_ids"] = ["Тренер не входит в состав заявки"]
        if not ids:
            errors["member_ids"] = ["Выберите спортсменов"]
        await self._check_people(contest, ids, None, user_id, errors, field="member_ids")
        if errors:
            raise ValidationFailed(fields=errors)
        created: list[int] = []
        for member_id in ids:
            item = await self._applications.add(
                ContestApplicationModel(
                    contest_id=contest.id,
                    created_by=user_id,
                    created_as=ApplicationCreator.COACH,
                    status=S.FORMING,
                )
            )
            await self._members.add(
                ContestApplicationMemberModel(
                    application_id=item.id,
                    contest_id=contest.id,
                    user_id=member_id,
                    confirmation=C.INVITED,
                    is_active=True,
                )
            )
            await self._write(AuditAction.APPLICATION_CREATE, item, user_id, ip, {"members": [str(member_id)]})
            created.append(item.id)
        await self._uow.commit()
        return [await self._reload(item_id) for item_id in created]

    async def rename(self, user_id: UUID, application_id: int, team_name: str, ip: str | None) -> ContestApplicationModel:
        item = await self._managed(user_id, application_id)
        if item.team_name is None:
            raise InvalidStatus()
        if await self._applications.team_name_taken(item.contest_id, team_name, item.id):
            raise NameTaken(fields={"team_name": ["Команда с таким названием уже заявлена"]})
        old = item.team_name
        await self._applications.update(item, {"team_name": team_name})
        await self._write(AuditAction.APPLICATION_UPDATE, item, user_id, ip, {"team_name": {"old": old, "new": team_name}})
        await self._uow.commit()
        return await self._reload(item.id)

    async def add_member(self, user_id: UUID, application_id: int, member_id: UUID, ip: str | None) -> ContestApplicationModel:
        item = await self._managed(user_id, application_id)
        contest = item.contest
        if contest.participation_type != ParticipationType.TEAM:
            raise InvalidStatus()
        if member_id == user_id and item.created_as == ApplicationCreator.COACH:
            raise ValidationFailed(fields={"user_id": ["Тренер не входит в состав заявки"]})
        active = [member for member in item.members if member.is_active]
        if any(member.user_id == member_id for member in active):
            raise ValidationFailed(fields={"user_id": ["Уже в составе"]})
        errors: dict[str, list[str]] = {}
        size = Eligibility.team_size_problem(contest, len(active) + 1, final=False)
        if size:
            errors["user_id"] = [size]
        await self._check_people(contest, [member_id], item.id, user_id, errors, field="user_id")
        if errors:
            raise ValidationFailed(fields=errors)
        previous = next((member for member in item.members if member.user_id == member_id), None)
        values = {"confirmation": C.INVITED, "is_active": True, "responded_at": None}
        if previous is not None:
            await self._members.update(previous, values)
        else:
            await self._members.add(
                ContestApplicationMemberModel(
                    application_id=item.id, contest_id=item.contest_id, user_id=member_id, **values
                )
            )
        await self._back_to_forming(item)
        await self._write(AuditAction.APPLICATION_MEMBER_ADD, item, user_id, ip, {"user_id": str(member_id)})
        await self._uow.commit()
        return await self._reload(item.id)

    async def remove_member(self, user_id: UUID, application_id: int, member_id: UUID, ip: str | None) -> ContestApplicationModel:
        item = await self._managed(user_id, application_id)
        member = next((member for member in item.members if member.user_id == member_id), None)
        if member is None:
            raise NotFound()
        if member.is_captain or item.contest.participation_type != ParticipationType.TEAM:
            raise InvalidStatus()
        await self._members.delete(member)
        await self._back_to_forming(item)
        await self._write(AuditAction.APPLICATION_MEMBER_REMOVE, item, user_id, ip, {"user_id": str(member_id)})
        await self._uow.commit()
        return await self._reload(item.id)

    async def confirm(self, user_id: UUID, application_id: int, ip: str | None) -> ContestApplicationModel:
        user = await self._user(user_id)
        item, member = await self._membership(user.id, application_id)
        if member.confirmation != C.INVITED or not member.is_active or item.status not in self.CHANGEABLE:
            raise InvalidStatus()
        self._ensure_registration(item.contest)
        problems = Eligibility.problems(user, item.contest)
        if problems:
            raise ValidationFailed(fields={"members": [f"Вы: {', '.join(problems)}"]})
        await self._members.update(member, {"confirmation": C.CONFIRMED, "responded_at": _now()})
        await self._write(AuditAction.APPLICATION_CONFIRM, item, user.id, ip, {})
        if item.contest.participation_type == ParticipationType.INDIVIDUAL:
            item = await self._reload(item.id)
            await self._submit(item)
            await self._write(AuditAction.APPLICATION_SUBMIT, item, user.id, ip, {})
        await self._uow.commit()
        return await self._reload(item.id)

    async def decline(self, user_id: UUID, application_id: int, ip: str | None) -> ContestApplicationModel:
        item, member = await self._membership(user_id, application_id)
        if member.confirmation == C.DECLINED or member.is_captain or item.status not in self.CHANGEABLE:
            raise InvalidStatus()
        if item.contest.status not in self.BEFORE_START:
            raise InvalidStatus()
        await self._members.update(member, {"confirmation": C.DECLINED, "is_active": False, "responded_at": _now()})
        if item.contest.participation_type == ParticipationType.INDIVIDUAL:
            await self._applications.update(item, {"status": S.WITHDRAWN})
        else:
            await self._back_to_forming(item)
        await self._write(AuditAction.APPLICATION_DECLINE, item, user_id, ip, {})
        await self._uow.commit()
        return await self._reload(item.id)

    async def submit(self, user_id: UUID, application_id: int, ip: str | None) -> ContestApplicationModel:
        item = await self._managed(user_id, application_id)
        if item.status != S.FORMING:
            raise InvalidStatus()
        await self._submit(item)
        await self._write(AuditAction.APPLICATION_SUBMIT, item, user_id, ip, {})
        await self._uow.commit()
        return await self._reload(item.id)

    async def withdraw(self, user_id: UUID, application_id: int, ip: str | None) -> ContestApplicationModel:
        item = await self._applications.lock(application_id)
        if item is None or not self._is_manager(item, user_id):
            raise NotFound()
        if item.status in {S.WITHDRAWN, S.REJECTED} or item.contest.status not in self.BEFORE_START:
            raise InvalidStatus()
        previous = item.status
        await self._applications.update(item, {"status": S.WITHDRAWN})
        for member in item.members:
            if member.is_active:
                await self._members.update(member, {"is_active": False})
        await self._write(AuditAction.APPLICATION_WITHDRAW, item, user_id, ip, {"from": previous.value})
        await self._uow.commit()
        return await self._reload(item.id)

    async def moderation_contests(
        self, user_id: UUID, is_federation: bool, limit: int, offset: int
    ) -> tuple[list[tuple[ContestModel, dict[ApplicationStatus, int]]], int]:
        return await self._applications.contest_counts(None if is_federation else user_id, limit, offset)

    async def moderation_list(
        self,
        user_id: UUID,
        is_federation: bool,
        contest_id: int,
        status: ApplicationStatus | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[Sequence[ContestApplicationModel], int]:
        contest = await self._contests.get(contest_id)
        if contest is None or (not is_federation and contest.organizer_id != user_id):
            raise NotFound()
        query = ApplicationQuery(
            contest_id=contest.id,
            statuses=frozenset({status}) if status else self.MODERATION_LIST,
            search=search,
        )
        return await self._applications.list_for_contest(query, limit, offset)

    async def approve(
        self, user_id: UUID, is_federation: bool, application_ids: list[int], ip: str | None
    ) -> list[ContestApplicationModel]:
        return await self._decide(user_id, is_federation, application_ids, S.APPROVED, None, ip)

    async def reject(
        self, user_id: UUID, is_federation: bool, application_ids: list[int], reason: str, ip: str | None
    ) -> list[ContestApplicationModel]:
        return await self._decide(user_id, is_federation, application_ids, S.REJECTED, reason, ip)

    async def reset(
        self, user_id: UUID, is_federation: bool, application_ids: list[int], ip: str | None
    ) -> list[ContestApplicationModel]:
        return await self._decide(user_id, is_federation, application_ids, S.SUBMITTED, None, ip)

    async def _decide(
        self,
        user_id: UUID,
        is_federation: bool,
        application_ids: list[int],
        target: ApplicationStatus,
        reason: str | None,
        ip: str | None,
    ) -> list[ContestApplicationModel]:
        ids = list(dict.fromkeys(application_ids))
        items = await self._applications.lock_many(ids)
        if len(items) != len(ids):
            await self._uow.rollback()
            raise NotFound()
        allowed = {S.APPROVED: {S.SUBMITTED}, S.REJECTED: {S.SUBMITTED}, S.SUBMITTED: {S.APPROVED, S.REJECTED}}[target]
        for item in items:
            if not is_federation and item.contest.organizer_id != user_id:
                await self._uow.rollback()
                raise NotFound()
            if item.status not in allowed or item.contest.status not in self.MODERATION:
                await self._uow.rollback()
                raise InvalidStatus()
        if target == S.SUBMITTED:
            await self._ensure_free_again(items)
        action = {
            S.APPROVED: AuditAction.APPLICATION_APPROVE,
            S.REJECTED: AuditAction.APPLICATION_REJECT,
            S.SUBMITTED: AuditAction.APPLICATION_RESET,
        }[target]
        now = _now()
        for item in items:
            previous = item.status
            await self._applications.update(
                item,
                {
                    "status": target,
                    "reject_reason": reason,
                    "decided_by": None if target == S.SUBMITTED else user_id,
                    "decided_at": None if target == S.SUBMITTED else now,
                },
            )
            for member in item.members:
                if member.confirmation == C.CONFIRMED:
                    await self._members.update(member, {"is_active": target != S.REJECTED})
            await self._write(action, item, user_id, ip, {"from": previous.value, "reason": reason})
        await self._uow.commit()
        return [await self._reload(item.id) for item in items]

    async def _ensure_free_again(self, items: list[ContestApplicationModel]) -> None:
        for item in items:
            if item.status != S.REJECTED:
                continue
            confirmed = [member.user_id for member in item.members if member.confirmation == C.CONFIRMED]
            busy = await self._members.busy_users(item.contest_id, confirmed, item.id)
            if busy:
                await self._uow.rollback()
                names = [_name(member.user) for member in item.members if member.user_id in busy]
                raise ValidationFailed(
                    fields={"ids": [f"Заявка №{item.id}: {', '.join(names)} уже в другой заявке на это соревнование"]}
                )

    async def _submit(self, item: ContestApplicationModel) -> None:
        contest = item.contest
        self._ensure_registration(contest)
        active = [member for member in item.members if member.is_active]
        errors: list[str] = []
        waiting = [_name(member.user) for member in active if member.confirmation != C.CONFIRMED]
        if waiting:
            errors.append(f"Ещё не подтвердили участие: {', '.join(waiting)}")
        size = Eligibility.team_size_problem(contest, len(active), final=True)
        if size:
            errors.append(size)
        for member in active:
            problems = Eligibility.problems(member.user, contest)
            if problems:
                errors.append(f"{_name(member.user)}: {', '.join(problems)}")
        if errors:
            raise ValidationFailed(fields={"members": errors})
        catalog = await self._age_catalog()
        for member in active:
            await self._members.update(
                member,
                {
                    "age_group_id": self._age_group_id(member.user, contest, catalog),
                    "academic_group_id": member.user.academic_group_id,
                },
            )
        await self._applications.update(
            item,
            {"status": S.SUBMITTED, "submitted_at": _now(), "reject_reason": None, "decided_by": None, "decided_at": None},
        )

    async def _back_to_forming(self, item: ContestApplicationModel) -> None:
        if item.status in {S.SUBMITTED, S.APPROVED}:
            await self._applications.update(
                item, {"status": S.FORMING, "submitted_at": None, "decided_by": None, "decided_at": None}
            )

    async def _check_people(
        self,
        contest: ContestModel,
        ids: list[UUID],
        application_id: int | None,
        actor_id: UUID,
        errors: dict[str, list[str]],
        field: str = "members",
    ) -> dict[UUID, UserModel]:
        users = await self._members.users(ids)
        busy = await self._members.busy_users(contest.id, ids, application_id)
        messages: list[str] = []
        for member_id in ids:
            user = users.get(member_id)
            if user is None or not user.is_active:
                messages.append("Спортсмен не найден")
                continue
            problems = Eligibility.problems(user, contest)
            if member_id in busy:
                problems.append("уже заявлен на это соревнование")
            if problems:
                who = "Вы" if member_id == actor_id else _name(user)
                messages.append(f"{who}: {', '.join(problems)}")
        if messages:
            errors.setdefault(field, []).extend(messages)
        return users

    async def _managed(self, user_id: UUID, application_id: int) -> ContestApplicationModel:
        item = await self._applications.lock(application_id)
        if item is None or not self._is_manager(item, user_id):
            raise NotFound()
        if item.status not in self.CHANGEABLE:
            raise InvalidStatus()
        self._ensure_registration(item.contest)
        return item

    async def _membership(
        self, user_id: UUID, application_id: int
    ) -> tuple[ContestApplicationModel, ContestApplicationMemberModel]:
        item = await self._applications.lock(application_id)
        member = next((member for member in item.members if member.user_id == user_id), None) if item else None
        if item is None or member is None:
            raise NotFound()
        return item, member

    async def _public_contest(self, contest_id: int) -> ContestModel:
        contest = await self._contests.get(contest_id)
        if contest is None or contest.status not in self.PUBLIC:
            raise NotFound()
        return contest

    async def _user(self, user_id: UUID) -> UserModel:
        user = (await self._members.users([user_id])).get(user_id)
        if user is None:
            raise NotFound()
        return user

    async def _age_catalog(self) -> list[DictionaryAgeGroupModel]:
        items = await self._dictionary.list("age_groups", include_archived=False)
        return [item for item in items if isinstance(item, DictionaryAgeGroupModel)]

    async def _reload(self, application_id: int) -> ContestApplicationModel:
        item = await self._applications.get(application_id)
        if item is None:
            raise NotFound()
        return item

    async def _write(
        self,
        action: AuditAction,
        item: ContestApplicationModel,
        user_id: UUID,
        ip: str | None,
        values: dict[str, Any],
    ) -> None:
        await self._audit.write(
            action,
            user_id=user_id,
            object_type="contest_application",
            payload={"id": item.id, "contest_id": item.contest_id, **values},
            ip=ip,
        )

    @staticmethod
    def _age_group_id(
        user: UserModel, contest: ContestModel, catalog: Sequence[DictionaryAgeGroupModel]
    ) -> int | None:
        group = Eligibility.age_group(user, contest, catalog)
        return group.id if group else None

    @staticmethod
    def _ensure_registration(contest: ContestModel) -> None:
        now = _now()
        if (
            contest.status != CS.REGISTRATION_OPEN
            or now < contest.registration_opens_at
            or now > contest.registration_closes_at
        ):
            raise RegistrationClosed()

    @staticmethod
    def _is_manager(item: ContestApplicationModel, user_id: UUID) -> bool:
        return item.created_by == user_id or any(
            member.is_captain and member.is_active and member.user_id == user_id for member in item.members
        )

    @staticmethod
    def _can_see(item: ContestApplicationModel, user_id: UUID, roles: frozenset[Role]) -> bool:
        return (
            Role.FEDERATION in roles
            or item.created_by == user_id
            or item.contest.organizer_id == user_id
            or any(member.user_id == user_id for member in item.members)
        )
