from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from core.errors import Forbidden, NotFound, ValidationFailed
from documents.repositories.pg_documents import DocumentRepository
from infrastructure.participation.document import DocumentModel
from infrastructure.enums import DOCUMENT_KIND_TITLES, QualificationKind, QualificationStatus, Role, RoleStatus
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.qualification import QualificationModel
from infrastructure.squads.squad import SquadModel
from infrastructure.account.user import UserModel
from infrastructure.sport.athlete_profile import AthleteProfileModel
from qualifications.repositories.pg_qualifications import QualificationRepository
from ratings.domain.ratings import Ratings, Standing
from reports.repositories.pg_reports import Coached, ReportRepository, Start
from squads.repositories.pg_squads import SquadRepository

ZONE = "Asia/Yekaterinburg"
SHOWN = (QualificationStatus.APPROVED, QualificationStatus.SUPERSEDED)


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo(ZONE)).date()


def full_name(user: UserModel) -> str:
    """Собирает фамилию, имя и отчество человека в одну строку."""
    return " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)


@dataclass(frozen=True, slots=True)
class DocumentLine:
    number: str
    kind: str
    title: str
    contest: str
    issued_on: str


@dataclass(frozen=True, slots=True)
class SquadLine:
    squad: SquadModel
    position: int
    is_reserve: bool
    points: int


@dataclass(slots=True)
class PersonReport:
    user: UserModel
    since: date
    until: date
    created: datetime
    roles: list[Role]
    profile: AthleteProfileModel | None = None
    starts: list[Start] = field(default_factory=list)
    standings: list[Standing] = field(default_factory=list)
    ranks: list[QualificationModel] = field(default_factory=list)
    categories: list[QualificationModel] = field(default_factory=list)
    documents: list[DocumentLine] = field(default_factory=list)
    squads: list[SquadLine] = field(default_factory=list)
    judged: list[JudgeAssignmentModel] = field(default_factory=list)
    coached: list[Coached] = field(default_factory=list)
    pupils: list[Standing] = field(default_factory=list)

    @property
    def points(self) -> int:
        """Суммирует баллы за все выступления периода."""
        return sum(item.points for item in self.starts)


class PersonReports:
    """Собирает отчёт по человеку: выступления, разряды, документы, сборные и судейство."""

    def __init__(
        self,
        reports: ReportRepository,
        qualifications: QualificationRepository,
        documents: DocumentRepository,
        squads: SquadRepository,
        ratings: Ratings,
    ) -> None:
        """Сохраняет зависимости."""
        self._reports, self._qualifications, self._documents = reports, qualifications, documents
        self._squads, self._ratings = squads, ratings

    @staticmethod
    def period(since: date | None, until: date | None) -> tuple[date, date]:
        """Определяет границы периода отчёта: по умолчанию последние 365 дней до сегодня."""
        end = until or today()
        start = since or end - timedelta(days=365)
        if start > end:
            raise ValidationFailed(fields={"from": ["Начало периода позже конца"]})
        return start, end

    async def can_view(self, viewer_id: UUID, viewer_roles: frozenset[Role], user_id: UUID) -> bool:
        """Проверяет, может ли смотрящий видеть отчёт: сам человек, федерация или его тренер."""
        if viewer_id == user_id or Role.FEDERATION in viewer_roles:
            return True
        return Role.COACH in viewer_roles and await self._reports.coaches(viewer_id, user_id)

    async def collect(
        self, viewer_id: UUID, viewer_roles: frozenset[Role], user_id: UUID, since: date | None, until: date | None
    ) -> PersonReport:
        """Собирает полный отчёт по человеку за период, проверив доступ смотрящего."""
        start, end = self.period(since, until)
        user = await self._reports.user(user_id)
        if user is None or not user.is_active:
            raise NotFound("Человек не найден")
        if not await self.can_view(viewer_id, viewer_roles, user_id):
            raise Forbidden("Отчёт доступен самому человеку, его тренеру и федерации")
        roles = [item.role for item in user.roles if item.status == RoleStatus.VERIFIED]
        history = [item for item in await self._qualifications.history([user_id]) if item.status in SHOWN]
        report = PersonReport(user=user, since=start, until=end, created=datetime.now(ZoneInfo(ZONE)), roles=roles)
        report.profile = await self._reports.profile(user_id)
        report.starts = await self._reports.starts(user_id, start, end)
        report.standings = await self._ratings.athlete(user_id) if Role.ATHLETE in roles else []
        report.ranks = [item for item in history if item.kind == QualificationKind.RANK]
        report.categories = [item for item in history if item.kind == QualificationKind.JUDGE_CATEGORY]
        report.documents = [self._document(item) for item in await self._documents.for_user(user_id) if self._within(item, start, end)]
        report.squads = [self._squad(squad, user_id) for squad in await self._squads.of_user(user_id)]
        report.judged = list(await self._reports.judged(user_id, start, end))
        report.coached = await self._reports.coached(user_id, start, end) if Role.COACH in roles else []
        if report.coached:
            ids = {item.athlete.id for item in report.coached}
            boards = await self._ratings.boards(None, None)
            report.pupils = sorted(
                (Standing(board, line) for board in boards for line in board.lines if line.user.id in ids),
                key=lambda item: (full_name(item.line.user), item.board.discipline.name, item.board.kind),
            )
        return report

    @staticmethod
    def _within(item: DocumentModel, start: date, end: date) -> bool:
        """Проверяет, что дата выдачи документа попадает в период."""
        issued = date.fromisoformat(item.data["form"]["issued_on"])
        return start <= issued <= end

    @staticmethod
    def _document(item: DocumentModel) -> DocumentLine:
        """Строит строку документа для отчёта из данных формы и соревнования."""
        form, contest = item.data["form"], item.data["contest"]
        return DocumentLine(
            number=item.number,
            kind=DOCUMENT_KIND_TITLES[item.kind],
            title=form["title"],
            contest=contest["title"],
            issued_on=date.fromisoformat(form["issued_on"]).strftime("%d.%m.%Y"),
        )

    @staticmethod
    def _squad(squad: SquadModel, user_id: UUID) -> SquadLine:
        """Строит строку сборной для отчёта с позицией и статусом участника."""
        member = next(item for item in squad.members if item.user_id == user_id)
        return SquadLine(squad=squad, position=member.position, is_reserve=member.is_reserve, points=member.points)
