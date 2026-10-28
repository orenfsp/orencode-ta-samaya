from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from core.errors import Forbidden, NotFound
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import ApplicationStatus, CalendarPlan, ContestStatus, Role, VerificationStatus
from readiness.repositories.pg_readiness import ReadinessRepository

S = ContestStatus
Step = Literal["prepare", "registration", "event", "after"]
STARTED = frozenset({S.IN_PROGRESS, S.COMPLETED, S.ARCHIVED})
FINISHED = frozenset({S.COMPLETED, S.ARCHIVED})
CLOSED = frozenset({S.REGISTRATION_CLOSED, *STARTED})
OPENED = frozenset({S.REGISTRATION_OPEN, *CLOSED})


@dataclass(frozen=True, slots=True)
class Check:
    key: str
    step: Step
    title: str
    done: bool
    hint: str
    warning: str | None = None


def expected_plan(level: str) -> CalendarPlan | None:
    """Возвращает календарный план, в который должно входить соревнование этого уровня."""
    name = level.lower()
    if "всерос" in name or "межрег" in name:
        return CalendarPlan.EKP
    if "регион" in name:
        return CalendarPlan.REGIONAL
    return None


class Readiness:
    """Чек-лист готовности соревнования для организатора и федерации."""

    def __init__(self, repository: ReadinessRepository) -> None:
        """Сохраняет репозиторий."""
        self._repository = repository

    async def contest(self, actor_id: UUID, roles: frozenset[Role], contest_id: int) -> tuple[ContestModel, list[Check]]:
        """Возвращает соревнование и чек-лист готовности для организатора и федерации."""
        contest = await self._repository.contest(contest_id)
        if contest is None:
            raise NotFound("Соревнование не найдено")
        if Role.FEDERATION not in roles and contest.organizer_id != actor_id:
            raise Forbidden()
        return contest, await self.checks(contest)

    async def checks(self, contest: ContestModel) -> list[Check]:
        """Собирает пункты чек-листа: положение, план, судьи, приём, верификация, места, документы."""
        positions = await self._repository.positions(contest.id)
        waiting = await self._repository.applications(contest.id, ApplicationStatus.SUBMITTED)
        approved = await self._repository.applications(contest.id, ApplicationStatus.APPROVED)
        results = await self._repository.results(contest.id)
        documents = await self._repository.documents(contest.id)
        expected = expected_plan(contest.contest_level.name)
        plan_set = contest.calendar_plan != CalendarPlan.NONE and bool(contest.calendar_plan_number)
        mismatch = (
            "Уровень соревнования предполагает "
            + ("ЕКП Минспорта" if expected == CalendarPlan.EKP else "календарный план области")
            if expected is not None and contest.calendar_plan not in (CalendarPlan.NONE, expected)
            else None
        )
        status = contest.status
        return [
            Check("regulations", "prepare", "Положение загружено", contest.regulations_file_id is not None,
                  "Загрузите положение в карточке соревнования"),
            Check("calendar_plan", "prepare", "Включено в календарный план, указан номер", plan_set,
                  "Укажите ЕКП или календарный план области и номер", mismatch),
            Check("verification", "prepare", "Верификация запрошена или пройдена",
                  contest.verification_status in (VerificationStatus.PENDING, VerificationStatus.VERIFIED),
                  "Запросите верификацию, чтобы места давали баллы"),
            Check("published", "prepare", "Опубликовано", status != S.DRAFT, "Опубликуйте соревнование"),
            Check("chief_judge", "prepare", "Назначен главный судья", "Главный судья" in positions,
                  "Назначьте коллегию в окне «Судьи»"),
            Check("secretary", "prepare", "Назначен главный секретарь", "Главный секретарь" in positions,
                  "Назначьте коллегию в окне «Судьи»"),
            Check("registration", "registration", "Приём заявок открыт", status in OPENED,
                  "Откройте регистрацию в срок"),
            Check("moderation", "registration", "Все заявки рассмотрены", status in OPENED and waiting == 0,
                  f"Ждут решения: {waiting}" if waiting else "Заявки появятся после открытия приёма"),
            Check("participants", "registration", "Есть одобренные участники", approved > 0,
                  "Одобрите заявки участников"),
            Check("results", "after", "Места внесены, протокол сформирован", status in STARTED and results > 0,
                  "Внесите места после старта соревнования"),
            Check("documents", "after", "Документы участникам выпущены", status in FINISHED and documents > 0,
                  "Выпустите дипломы и сертификаты после завершения"),
        ]
