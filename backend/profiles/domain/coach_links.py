from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import AppError, Forbidden, InvalidStatus, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from infrastructure.sport.coach_link_event import CoachLinkEventModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.enums import COACH_LINK_STATUS_TITLES, CoachLinkStatus, Role, RoleStatus
from infrastructure.account.user import UserModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T
from profiles.repositories.pg_coach_links import CoachLinkRepository

S = CoachLinkStatus
Action = Literal["accept", "decline", "suspend", "resume", "end"]

MOVES: dict[Action, tuple[frozenset[CoachLinkStatus], CoachLinkStatus, Literal["athlete", "both"]]] = {
    "accept": (frozenset({S.REQUESTED}), S.ACTIVE, "athlete"),
    "decline": (frozenset({S.REQUESTED}), S.DECLINED, "athlete"),
    "suspend": (frozenset({S.ACTIVE}), S.SUSPENDED, "both"),
    "resume": (frozenset({S.SUSPENDED}), S.ACTIVE, "both"),
    "end": (frozenset({S.REQUESTED, S.ACTIVE, S.SUSPENDED}), S.ENDED, "both"),
}


class LinkExists(AppError):
    status_code = 409
    code = "link_exists"
    message = "Связь по этой дисциплине уже есть или ждёт подтверждения"


def short(user: UserModel) -> str:
    """Фамилия и имя человека для текстов уведомлений."""
    return f"{user.last_name} {user.first_name}"


def verified(user: UserModel, role: Role) -> bool:
    """Проверяет, что у человека подтверждена роль."""
    return any(item.role == role and item.status == RoleStatus.VERIFIED for item in user.roles)


class CoachLinks:
    """Связи тренер ↔ спортсмен: запрос, подтверждение, пауза, завершение и история."""

    def __init__(
        self,
        uow: UnitOfWork,
        links: CoachLinkRepository,
        users: UserRepository,
        dictionary: DictionaryRepository,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._links, self._users, self._dictionary = uow, links, users, dictionary
        self._audit, self._notifications = audit, notifications

    async def mine(self, user_id: UUID) -> tuple[Sequence[CoachLinkModel], Sequence[CoachLinkModel]]:
        """Возвращает связи человека как тренера и как спортсмена."""
        return await self._links.of_coach(user_id), await self._links.of_athlete(user_id)

    async def search(self, coach_id: UUID, q: str | None) -> tuple[Sequence[UserModel], set[UUID]]:
        """Ищет спортсменов для запроса тренера и отмечает уже привязанных."""
        return await self._links.athletes(q, coach_id), await self._links.active_athlete_ids(coach_id)

    async def request(
        self, coach_id: UUID, roles: frozenset[Role], athlete_id: UUID, discipline_id: int, comment: str | None,
        ip: str | None,
    ) -> CoachLinkModel:
        """Тренер запрашивает связь со спортсменом по дисциплине; спортсмен получает уведомление."""
        if Role.COACH not in roles:
            raise Forbidden("Запрос отправляет тренер с подтверждённой ролью")
        athlete = await self._users.get(athlete_id)
        if athlete is None or not athlete.is_active or not verified(athlete, Role.ATHLETE) or athlete_id == coach_id:
            raise ValidationFailed(fields={"athlete_id": ["Выберите спортсмена из реестра"]})
        discipline = await self._dictionary.get(DictionaryDisciplineModel, discipline_id)
        if discipline is None or discipline.is_archived:
            raise ValidationFailed(fields={"discipline_id": ["Выберите дисциплину"]})
        if await self._links.open_link(coach_id, athlete_id, discipline_id):
            raise LinkExists()
        coach = await self._users.get(coach_id)
        assert coach is not None
        link = CoachLinkModel(coach_id=coach_id, athlete_id=athlete_id, discipline_id=discipline_id, status=S.REQUESTED)
        link.events = [CoachLinkEventModel(status=S.REQUESTED, actor_id=coach_id, comment=(comment or "").strip() or None)]
        link = await self._links.add(link)
        await self._audit.write(AuditAction.COACH_LINK_REQUEST, coach_id, "coach_link", link.id,
                                {"athlete_id": str(athlete_id), "discipline": discipline.name}, ip)
        await self._notifications.coach_link(
            athlete_id, coach_id, T.COACH_LINK_REQUESTED, "Тренер просит подтвердить привязку",
            f"{short(coach)} хочет вести вас по дисциплине «{discipline.name}». Подтвердите или отклоните запрос.",
            "/cabinet/athlete/profile",
        )
        await self._uow.commit()
        return await self._links.refresh(link)

    async def move(
        self, actor_id: UUID, link_id: UUID, action: Action, comment: str | None, ip: str | None
    ) -> CoachLinkModel:
        """Переводит связь по действию стороны: принять, отклонить, приостановить, возобновить, завершить."""
        link = await self._links.get(link_id)
        if link is None:
            raise NotFound()
        allowed, target, who = MOVES[action]
        is_athlete, is_coach = actor_id == link.athlete_id, actor_id == link.coach_id
        if not (is_athlete or (who == "both" and is_coach)):
            raise Forbidden("Это действие недоступно")
        if link.status not in allowed:
            raise InvalidStatus(f"Связь уже в статусе «{COACH_LINK_STATUS_TITLES[link.status].lower()}»")
        link.status = target
        link.events.append(CoachLinkEventModel(status=target, actor_id=actor_id, comment=(comment or "").strip() or None))
        await self._links.flush()
        await self._audit.write(AuditAction.COACH_LINK_CHANGE, actor_id, "coach_link", link.id,
                                {"action": action, "status": target.value}, ip)
        other = link.coach_id if is_athlete else link.athlete_id
        actor = link.athlete if is_athlete else link.coach
        kind = T.COACH_LINK_DECIDED if action in ("accept", "decline") else T.COACH_LINK_CHANGED
        text = f"{short(actor)}: связь по дисциплине «{link.discipline.name}» — {COACH_LINK_STATUS_TITLES[target].lower()}."
        await self._notifications.coach_link(
            other, actor_id, kind, "Связь тренера и спортсмена", text,
            "/cabinet/coach/athletes" if is_athlete else "/cabinet/athlete/profile",
        )
        await self._uow.commit()
        return await self._links.refresh(link)

    async def get(self, actor_id: UUID, link_id: UUID, is_federation: bool) -> CoachLinkModel:
        """Возвращает связь участнику или федерации; иначе NotFound."""
        link = await self._links.get(link_id)
        if link is None:
            raise NotFound()
        if not is_federation and actor_id not in (link.coach_id, link.athlete_id):
            raise Forbidden()
        return link
