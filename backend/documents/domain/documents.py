import hashlib
import hmac
import json
import secrets
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

import segno
from jinja2 import Environment, FileSystemLoader, select_autoescape

from applications.repositories.pg_applications import ApplicationRepository
from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.config import Settings
from core.database import UnitOfWork
from core.errors import Forbidden, InvalidStatus, NotFound, ValidationFailed
from documents.repositories.pg_documents import DocumentRepository
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.document import DocumentModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus, ContestStatus, DocumentKind, QualificationKind
from infrastructure.account.user import UserModel
from qualifications.repositories.pg_qualifications import QualificationRepository
from results.repositories.pg_results import ResultRepository

S = ContestStatus
K = DocumentKind
Recipients = Literal["participants", "winners"]

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
TEMPLATES = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))
TEMPLATES.filters["ru_date"] = lambda value: date.fromisoformat(value).strftime("%d.%m.%Y")

ICONS = (
    (("алгоритм", "олимпиад"), "algorithmic"),
    (("продукт", "хакатон"), "product"),
    (("безопасн", "ctf"), "security"),
    (("искусствен", "машинн"), "ai"),
    (("робот",), "robotics"),
    (("беспилот", "бпла", "дрон"), "drones"),
    (("квиз", "викторин"), "quiz"),
)


@dataclass(frozen=True, slots=True)
class DocumentForm:
    title: str
    lead: str | None
    text: str | None
    recipients: Recipients
    places_to: int
    signer_position: str | None
    signer_name: str | None
    issued_on: date
    judge_ids: list[str] | None = None

    def plain(self) -> dict[str, Any]:
        """Сериализует форму в обычный словарь для хранения в JSON."""
        return {**asdict(self), "issued_on": self.issued_on.isoformat()}

    @classmethod
    def from_plain(cls, data: dict[str, Any]) -> "DocumentForm":
        """Восстанавливает форму из словаря, сохранённого в JSON."""
        return cls(**{**data, "issued_on": date.fromisoformat(data["issued_on"])})


@dataclass(slots=True)
class Person:
    user: UserModel
    role: Literal["athlete", "coach", "judge", "organizer"]
    team: str | None = None
    place: int | None = None
    athletes: list[str] | None = None
    disqualified: bool = False
    position: str | None = None
    panel: list[dict[str, str | None]] | None = None


def full_name(user: UserModel) -> str:
    """Собирает полное имя пользователя из фамилии, имени и отчества."""
    return " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)


def short_name(user: UserModel) -> str:
    """Собирает имя вида «Фамилия И.О.»."""
    initials = " ".join(f"{part[0]}." for part in (user.first_name, user.middle_name) if part)
    return f"{user.last_name} {initials}".strip()


def _dates(starts: date, ends: date) -> str:
    """Форматирует период соревнования: одна дата или диапазон."""
    return f"{starts:%d.%m.%Y}" if starts == ends else f"{starts:%d.%m.%Y} — {ends:%d.%m.%Y}"


class Documents:
    """Выпускает, хранит и подписывает документы (дипломы, справки и т.п.) по соревнованиям."""

    STATUSES = frozenset({S.IN_PROGRESS, S.COMPLETED, S.ARCHIVED})
    PUBLIC_STATUSES = frozenset(set(S) - {S.DRAFT, S.ARCHIVED})
    LAYOUTS: dict[DocumentKind, str] = {
        K.CERTIFICATE: "award.html",
        K.DIPLOMA: "award.html",
        K.GRAMOTA: "award.html",
        K.THANKS: "award.html",
        K.JUDGE_THANKS: "award.html",
        K.REFERENCE: "reference.html",
        K.JUDGE_PANEL: "judge_panel.html",
    }

    def __init__(
        self,
        uow: UnitOfWork,
        documents: DocumentRepository,
        contests: ContestRepository,
        applications: ApplicationRepository,
        results: ResultRepository,
        qualifications: QualificationRepository,
        audit: Audit,
        settings: Settings,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._qualifications = qualifications
        self._documents = documents
        self._contests = contests
        self._applications = applications
        self._results = results
        self._audit = audit
        self._settings = settings

    @staticmethod
    def icon(discipline: str) -> str:
        """Подбирает иконку по названию дисциплины; «generic», если ничего не подошло."""
        text = discipline.lower()
        return next((icon for words, icon in ICONS if any(word in text for word in words)), "generic")

    async def issue(
        self, user_id: UUID, is_federation: bool, contest_id: int, kind: DocumentKind, form: DocumentForm, ip: str | None
    ) -> Sequence[DocumentModel]:
        """Выпускает документы вида kind для соревнования, пишет аудит и возвращает их."""
        contest = await self._managed(user_id, is_federation, contest_id, lock=True)
        count = await self.store_for(contest, kind, form, user_id)
        if not count:
            raise ValidationFailed(fields={"recipients": [self._nobody(kind, form)]})
        await self._audit.write(
            AuditAction.DOCUMENTS_ISSUE,
            user_id=user_id,
            object_type="contest",
            payload={"id": contest.id, "title": contest.title, "kind": kind.value, "count": count},
            ip=ip,
        )
        await self._uow.commit()
        return await self._documents.for_contest(contest.id, kind)

    async def remove(self, user_id: UUID, is_federation: bool, contest_id: int, kind: DocumentKind, ip: str | None) -> None:
        """Удаляет документы вида kind у соревнования и пишет аудит."""
        contest = await self._managed(user_id, is_federation, contest_id, lock=True)
        await self._documents.remove(contest.id, kind)
        await self._audit.write(
            AuditAction.DOCUMENTS_REMOVE,
            user_id=user_id,
            object_type="contest",
            payload={"id": contest.id, "title": contest.title, "kind": kind.value},
            ip=ip,
        )
        await self._uow.commit()

    async def store_for(self, contest: ContestModel, kind: DocumentKind, form: DocumentForm, issued_by: UUID | None) -> int:
        """Определяет получателей и сохраняет для них документы вида kind; возвращает их число."""
        people = await self.recipients(contest, kind, form)
        if people:
            await self._store(contest, kind, form, people, issued_by)
        return len(people)

    async def reissue(self, contest: ContestModel) -> None:
        """Пересчитывает и переиздаёт все существующие виды документов соревнования по изменившимся данным."""
        existing = await self._documents.for_contest(contest.id)
        forms: dict[DocumentKind, tuple[DocumentForm, UUID | None]] = {}
        for item in existing:
            forms.setdefault(item.kind, (DocumentForm.from_plain(item.data["form"]), item.issued_by))
        for kind, (form, issued_by) in forms.items():
            people = await self.recipients(contest, kind, form)
            if people:
                await self._store(contest, kind, form, people, issued_by)
            else:
                await self._documents.remove(contest.id, kind)

    async def preview(
        self, user_id: UUID, is_federation: bool, contest_id: int, kind: DocumentKind, form: DocumentForm
    ) -> bytes:
        """Строит PDF-превью документа для первого получателя без сохранения."""
        contest = await self._managed(user_id, is_federation, contest_id)
        people = await self.recipients(contest, kind, form)
        if not people:
            raise ValidationFailed(fields={"recipients": [self._nobody(kind, form)]})
        data = self._snapshot(contest, kind, form, people[0])
        return self._pdf(kind, [(data, "preview", "0000-000000")])

    async def public(self, contest_id: int) -> tuple[ContestModel, Sequence[DocumentModel]]:
        """Возвращает публично видимое соревнование и его документы."""
        contest = await self._contests.get(contest_id)
        if contest is None or contest.status not in self.PUBLIC_STATUSES:
            raise NotFound()
        return contest, await self._documents.for_contest(contest.id)

    def sign(self, item: DocumentModel) -> str:
        """Считает подпись HMAC-SHA256 для содержимого документа."""
        payload = {
            "token": item.token,
            "number": item.number,
            "kind": item.kind.value,
            "user_id": str(item.user_id),
            "contest_id": item.contest_id,
            "data": item.data,
        }
        message = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        secret = self._settings.document_signing_secret.get_secret_value().encode()
        return hmac.new(secret, message, hashlib.sha256).hexdigest()

    def is_valid(self, item: DocumentModel) -> bool:
        """Проверяет, что подпись документа соответствует его текущим данным."""
        return hmac.compare_digest(self.sign(item), item.signature)

    async def mine(
        self, user_id: UUID, kind: DocumentKind | None = None, oldest_first: bool = False
    ) -> Sequence[DocumentModel]:
        """Возвращает документы пользователя, опционально отфильтрованные по виду."""
        return await self._documents.list_for_user(user_id, kind, oldest_first)

    async def available(self, user_id: UUID) -> list[ContestModel]:
        """Возвращает соревнования пользователя, по которым ещё не запрошена справка."""
        mine = {(item.contest_id) for item in await self._documents.for_user(user_id) if item.kind == K.REFERENCE}
        return [contest for contest in await self._participations(user_id) if contest.id not in mine]

    async def request_reference(self, user_id: UUID, contest_id: int) -> Sequence[DocumentModel]:
        """Выдаёт пользователю справку по соревнованию, переиспользуя готовую форму, если она уже выпускалась."""
        own = [item for item in await self._documents.for_user(user_id) if item.contest_id == contest_id and item.kind == K.REFERENCE]
        if own:
            return own
        contest = next((item for item in await self._participations(user_id) if item.id == contest_id), None)
        if contest is None:
            raise Forbidden("По этому соревнованию справку получить нельзя")
        issued = await self._documents.for_contest(contest.id, K.REFERENCE)
        form = DocumentForm.from_plain(issued[0].data["form"]) if issued else self._default_reference()
        people = [person for person in await self.recipients(contest, K.REFERENCE, form) if person.user.id == user_id]
        if not people:
            raise Forbidden("По этому соревнованию справку получить нельзя")
        items = self._make(contest, K.REFERENCE, form, people, user_id)
        await self._documents.add(items)
        await self._finish(items, form)
        await self._uow.commit()
        return items

    async def get(self, token: str) -> DocumentModel:
        """Возвращает документ по токену или поднимает NotFound."""
        item = await self._documents.by_token(token)
        if item is None:
            raise NotFound()
        return item

    async def pdf(self, token: str) -> tuple[str, bytes]:
        """Строит PDF одного документа по токену; возвращает имя файла и байты."""
        item = await self.get(token)
        return f"{item.number}.pdf", self._pdf(item.kind, [(item.data, item.token, item.number)])

    async def contest_pdf(self, contest_id: int, kind: DocumentKind) -> tuple[str, bytes]:
        """Строит PDF со всеми документами вида kind соревнования; возвращает имя файла и байты."""
        _, items = await self.public(contest_id)
        chosen = [item for item in items if item.kind == kind]
        if not chosen:
            raise NotFound()
        return f"{kind.value}-{contest_id}.pdf", self._pdf(kind, [(item.data, item.token, item.number) for item in chosen])

    async def recipients(self, contest: ContestModel, kind: DocumentKind, form: DocumentForm) -> list[Person]:
        """Определяет получателей документа вида kind: спортсмены, тренеры или судьи по правилам вида."""
        if kind == K.JUDGE_PANEL:
            return await self._panel(contest)
        entries = await self._applications.list_approved(contest.id)
        results = {(row.application_id, row.user_id): row.place for row in await self._results.list(contest.id)}
        entered = {application_id for application_id, _ in results}
        athletes: list[Person] = []
        for entry in entries:
            for member in entry.members:
                if not member.is_active:
                    continue
                place = results.get((entry.id, member.user_id))
                disqualified = entry.id in entered and place is None
                athletes.append(Person(member.user, "athlete", entry.team_name, place, disqualified=disqualified))
        finished = [person for person in athletes if not person.disqualified]
        winners = [person for person in finished if person.place is not None and person.place <= form.places_to]
        if kind == K.CERTIFICATE:
            chosen = [Person(person.user, "athlete", person.team) for person in finished]
        elif kind == K.DIPLOMA or (kind == K.GRAMOTA and form.recipients == "winners"):
            chosen = winners
        elif kind == K.GRAMOTA:
            chosen = [Person(person.user, "athlete", person.team) for person in finished]
        elif kind == K.THANKS:
            chosen = self._coaches(entries, results, placed_only=True)
        elif kind == K.JUDGE_THANKS:
            picked = set(form.judge_ids) if form.judge_ids is not None else None
            chosen = [
                Person(item.judge, "judge", position=item.position.name)
                for item in await self._results.judges(contest.id)
                if picked is None or str(item.judge_id) in picked
            ]
        else:
            chosen = [Person(person.user, "athlete", person.team, person.place) for person in athletes]
            chosen += self._coaches(entries, results, placed_only=False)
            chosen += [
                Person(item.judge, "judge", position=item.position.name)
                for item in await self._results.judges(contest.id)
            ]
        return sorted(chosen, key=lambda item: (item.role, item.place or 10**6, item.team or "", full_name(item.user)))

    async def _panel(self, contest: ContestModel) -> list[Person]:
        """Справка о составе коллегии — одна на соревнование, получатель организатор; в ней судьи с категорией на дату старта."""
        judges = await self._results.judges(contest.id)
        if not judges:
            return []
        categories = await self._qualifications.valid_on(
            [item.judge_id for item in judges], QualificationKind.JUDGE_CATEGORY, contest.starts_on
        )
        panel: list[dict[str, str | None]] = []
        for item in judges:
            category = categories.get(item.judge_id)
            panel.append({
                "name": full_name(item.judge),
                "position": item.position.name,
                "category": category.judge_category.name if category and category.judge_category else None,
                "valid_until": category.valid_until.isoformat() if category and category.valid_until else None,
            })
        return [Person(contest.organizer, "organizer", panel=panel)]

    @staticmethod
    def _coaches(
        entries: Sequence[ContestApplicationModel], results: dict[tuple[int, UUID], int | None], placed_only: bool
    ) -> list[Person]:
        """Собирает тренеров заявок-команд с описанием их подопечных и мест (если placed_only — только призовых)."""
        coaches: dict[UUID, Person] = {}
        for entry in entries:
            if entry.created_as != ApplicationCreator.COACH:
                continue
            members = [member for member in entry.members if member.is_active]
            place = next((results.get((entry.id, member.user_id)) for member in members), None)
            if placed_only and place is None:
                continue
            who = f"команда «{entry.team_name}»" if entry.team_name else ", ".join(short_name(member.user) for member in members)
            line = f"{who} — {place} место" if place is not None else who
            person = coaches.setdefault(entry.created_by, Person(entry.creator, "coach", athletes=[]))
            assert person.athletes is not None
            person.athletes.append(line)
        return list(coaches.values())

    def _snapshot(self, contest: ContestModel, kind: DocumentKind, form: DocumentForm, person: Person) -> dict[str, Any]:
        """Собирает снимок данных документа для сохранения и рендера шаблона."""
        return {
            "form": form.plain(),
            "kind": kind.value,
            "icon": self.icon(contest.discipline.name),
            "contest": {
                "id": contest.id,
                "title": contest.title,
                "discipline": contest.discipline.name,
                "dates": _dates(contest.starts_on, contest.ends_on),
                "place": contest.municipality.name if contest.municipality else None,
                "organizer": full_name(contest.organizer),
            },
            "recipient": {
                "name": full_name(person.user),
                "short": short_name(person.user),
                "role": person.role,
                "team": person.team,
                "place": person.place,
                "athletes": person.athletes or [],
                "position": person.position,
                "panel": person.panel or [],
            },
        }

    async def _store(
        self, contest: ContestModel, kind: DocumentKind, form: DocumentForm, people: Sequence[Person], issued_by: UUID | None
    ) -> None:
        """Заменяет документы вида kind соревнования новым набором для people."""
        items = self._make(contest, kind, form, people, issued_by)
        await self._documents.replace(contest.id, kind, items)
        await self._finish(items, form)

    def _make(
        self, contest: ContestModel, kind: DocumentKind, form: DocumentForm, people: Sequence[Person], issued_by: UUID | None
    ) -> list[DocumentModel]:
        """Строит новые модели документов для каждого получателя с уникальным токеном."""
        return [
            DocumentModel(
                token=secrets.token_urlsafe(12),
                contest_id=contest.id,
                kind=kind,
                user_id=person.user.id,
                data=self._snapshot(contest, kind, form, person),
                issued_by=issued_by,
            )
            for person in people
        ]

    async def _finish(self, items: Sequence[DocumentModel], form: DocumentForm) -> None:
        """Проставляет номера документов и подписи после их сохранения в БД."""
        for item in items:
            item.number = f"{form.issued_on.year}-{item.id:06d}"
            item.signature = self.sign(item)
        await self._documents.flush()

    async def _participations(self, user_id: UUID) -> list[ContestModel]:
        """Возвращает завершённые соревнования, где пользователь участник, тренер или судья."""
        entries = [*await self._applications.list_for_member(user_id), *await self._applications.list_for_coach(user_id)]
        contests: dict[int, ContestModel] = {}
        for entry in entries:
            if entry.status != ApplicationStatus.APPROVED or entry.contest.status not in self.STATUSES:
                continue
            member = any(item.user_id == user_id and item.is_active for item in entry.members)
            coach = entry.created_as == ApplicationCreator.COACH and entry.created_by == user_id
            if member or coach:
                contests.setdefault(entry.contest_id, entry.contest)
        for contest in await self._documents.judged(user_id):
            if contest.status in self.STATUSES:
                contests.setdefault(contest.id, contest)
        return sorted(contests.values(), key=lambda item: item.starts_on, reverse=True)

    @staticmethod
    def _default_reference() -> DocumentForm:
        """Строит стандартную форму справки об участии."""
        return DocumentForm(
            title="об участии в соревновании",
            lead=None,
            text="Справка выдана для предъявления по месту требования.",
            recipients="participants",
            places_to=3,
            signer_position=None,
            signer_name=None,
            issued_on=datetime.now(ZoneInfo("Asia/Yekaterinburg")).date(),
        )

    def _pdf(self, kind: DocumentKind, items: Sequence[tuple[dict[str, Any], str, str]]) -> bytes:
        """Рендерит PDF c QR-кодами для всех переданных снимков документов вида kind."""
        pages = []
        for data, token, number in items:
            url = f"{self._settings.frontend_url.rstrip('/')}/documents/{token}"
            qr = segno.make(url, error="m").svg_inline(dark="#1B1C21", border=0, omitsize=True)
            pages.append({**data, "token": token, "number": number, "url": url, "qr": qr})
        html = TEMPLATES.get_template(self.LAYOUTS[kind]).render(pages=pages)
        from weasyprint import HTML

        return HTML(string=html, base_url=str(ASSETS) + "/").write_pdf() or b""

    async def _managed(self, user_id: UUID, is_federation: bool, contest_id: int, lock: bool = False) -> ContestModel:
        """Возвращает соревнование, проверяя, что пользователь имеет к нему доступ и оно в подходящем статусе."""
        contest = await (self._contests.lock(contest_id) if lock else self._contests.get(contest_id))
        if contest is None or (not is_federation and contest.organizer_id != user_id):
            raise NotFound()
        if contest.status not in self.STATUSES:
            raise InvalidStatus()
        return contest

    @staticmethod
    def _nobody(kind: DocumentKind, form: DocumentForm) -> str:
        """Подбирает текст ошибки для случая, когда получателей документа не нашлось."""
        if kind == K.JUDGE_THANKS:
            return "В судейской коллегии нет судей или никто не выбран"
        if kind == K.JUDGE_PANEL:
            return "В судейской коллегии нет судей: сначала назначьте коллегию"
        if kind == K.THANKS:
            return "Нет тренеров, чьи спортсмены получили место: благодарность связывается через заявки тренера"
        if kind == K.DIPLOMA or (kind == K.GRAMOTA and form.recipients == "winners"):
            return f"Нет участников с местами 1–{form.places_to}: сначала внесите места"
        return "У соревнования нет одобренных участников"
