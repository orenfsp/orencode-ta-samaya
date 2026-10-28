from collections.abc import Sequence
from uuid import UUID

from applications.repositories.pg_applications import ApplicationRepository
from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.database import UnitOfWork
from core.errors import InvalidStatus, NotFound, ValidationFailed
from documents.domain.documents import Documents
from evsk.domain.evsk import Evsk
from files.repositories.s3_files import ObjectRepository
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.enums import JUDGE_DOCUMENT_KIND_TITLES, ContestStatus, VerificationStatus
from notifications.domain.notifications import Notifications
from results.domain.protocol import JudgeFile, Protocol
from results.repositories.pg_results import ResultRepository

S = ContestStatus


class Results:
    """Домен результатов соревнования: занесение мест, расчёт баллов и формирование протокола."""

    EDITABLE = frozenset({S.IN_PROGRESS, S.COMPLETED})
    PUBLIC_STATUSES = frozenset(set(S) - {S.DRAFT, S.ARCHIVED})

    def __init__(
        self,
        uow: UnitOfWork,
        results: ResultRepository,
        applications: ApplicationRepository,
        contests: ContestRepository,
        audit: Audit,
        notifications: Notifications,
        documents: Documents,
        storage: ObjectRepository,
        evsk: Evsk | None = None,
    ) -> None:
        """Сохраняет зависимости."""
        self._storage, self._evsk = storage, evsk
        self._uow = uow
        self._results = results
        self._applications = applications
        self._contests = contests
        self._audit = audit
        self._notifications = notifications
        self._documents = documents

    @staticmethod
    def places_valid(places: Sequence[int]) -> bool:
        """Проверяет, что места идут подряд с 1 без повторов."""
        ordered = sorted(places)
        return ordered == list(range(1, len(ordered) + 1))

    @staticmethod
    def points_for(contest: ContestModel, place: int | None) -> int:
        """Возвращает баллы рейтинга за место; 0 для дисквалификации или неверифицированного соревнования."""
        if place is None or contest.verification_status != VerificationStatus.VERIFIED:
            return 0
        return next((row["points"] for row in contest.rating_points or [] if row["place"] == place), 0)

    async def public(
        self, contest_id: int
    ) -> tuple[ContestModel, Sequence[ContestResultModel], dict[int, str | None]]:
        """Возвращает соревнование, его результаты и названия команд для публичного просмотра."""
        contest = await self._contests.get(contest_id)
        if contest is None or contest.status not in self.PUBLIC_STATUSES:
            raise NotFound()
        teams = {entry.id: entry.team_name for entry in await self._applications.list_approved(contest.id)}
        return contest, await self._results.list(contest.id), teams

    async def form(
        self, user_id: UUID, is_federation: bool, contest_id: int
    ) -> tuple[ContestModel, Sequence[ContestApplicationModel], dict[int, int | None]]:
        """Возвращает соревнование, одобренные заявки и текущие места для формы ввода результатов."""
        contest = await self._own(user_id, is_federation, contest_id)
        entries = await self._applications.list_approved(contest.id)
        places = {item.application_id: item.place for item in await self._results.list(contest.id)}
        return contest, entries, places

    async def save(
        self,
        user_id: UUID,
        is_federation: bool,
        contest_id: int,
        items: Sequence[tuple[int, int | None]],
        ip: str | None,
        reason: str | None = None,
    ) -> None:
        """Сохраняет места участников, пересчитывает баллы и переиздаёт документы; reason — основание правки в журнале."""
        contest = await self._own(user_id, is_federation, contest_id, lock=True)
        if contest.status not in self.EDITABLE:
            raise InvalidStatus()
        entries = {item.id: item for item in await self._applications.list_approved(contest.id)}
        places = dict(items)
        if len(places) != len(items) or places.keys() != entries.keys():
            raise ValidationFailed(fields={"items": ["Укажите место или дисквалификацию у каждого участника"]})
        if any(place is not None and place < 1 for place in places.values()):
            raise ValidationFailed(fields={"items": ["Место начинается с 1"]})
        if not self.places_valid([place for place in places.values() if place is not None]):
            raise ValidationFailed(fields={"items": ["Места идут подряд с 1 и не повторяются"]})
        previous = {item.user_id: item.place for item in await self._results.list(contest.id)}
        rows = [
            ContestResultModel(
                contest_id=contest.id,
                application_id=application_id,
                user_id=member.user_id,
                place=place,
                points=self.points_for(contest, place),
            )
            for application_id, place in places.items()
            for member in entries[application_id].members
            if member.is_active
        ]
        await self._results.replace(contest.id, rows)
        await self._documents.reissue(contest)
        changed = [(row.user_id, row.place) for row in rows if row.user_id not in previous or previous[row.user_id] != row.place]
        await self._notifications.results_entered(changed, user_id, contest.id, contest.title)
        await self._audit.write(
            AuditAction.RESULTS_UPDATE,
            user_id=user_id,
            object_type="contest",
            payload={"id": contest.id, "title": contest.title, "entries": len(places), **({"reason": reason} if reason else {})},
            ip=ip,
        )
        await self._uow.commit()

    async def protocol(self, user_id: UUID, is_federation: bool, contest_id: int) -> tuple[str, bytes]:
        """Формирует xlsx-протокол соревнования и возвращает имя файла с его содержимым."""
        contest = await self._own(user_id, is_federation, contest_id)
        entries = await self._applications.list_approved(contest.id)
        results = await self._results.list(contest.id)
        judges = await self._results.judges(contest.id)
        files = [
            JudgeFile(
                judge=item.judge,
                position=item.assignment.position.name if item.assignment else "",
                kind=JUDGE_DOCUMENT_KIND_TITLES[item.kind],
                name=item.file.original_name,
                url=self._storage.public_url(item.file.object_key),
                comment=item.comment or "",
                removed=item.assignment is None or item.assignment.removed_at is not None,
            )
            for item in await self._results.judge_documents(contest.id)
        ]
        ranks = [
            (f"{item.user.last_name} {item.user.first_name}", item.result.place or 0, item.rule.rank_type.name)
            for item in await self._evsk.candidates(contest)
        ] if self._evsk else []
        profiles = await self._results.profiles([member.user_id for entry in entries for member in entry.members if member.is_active])
        organizations = {item.user_id: item.organization.short_name or item.organization.name if item.organization else "Без организации" if item.no_organization else "" for item in profiles}
        categories: dict[UUID, str] = {}
        for category in await self._results.categories([item.judge_id for item in judges]):
            if category.user_id not in categories and category.valid_from and category.valid_from <= contest.starts_on and (category.valid_until is None or category.valid_until >= contest.starts_on):
                categories[category.user_id] = category.item_name
        return f"protocol-{contest.id}.xlsx", Protocol.build(contest, entries, results, judges, files, ranks, organizations, categories)

    async def _own(self, user_id: UUID, is_federation: bool, contest_id: int, lock: bool = False) -> ContestModel:
        """Возвращает соревнование, если пользователь — его организатор или федерация; при lock блокирует строку."""
        contest = await (self._contests.lock(contest_id) if lock else self._contests.get(contest_id))
        if contest is None or (not is_federation and contest.organizer_id != user_id):
            raise NotFound()
        return contest
