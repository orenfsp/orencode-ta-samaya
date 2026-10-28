import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import NotFound, ValidationFailed
from audit.dependencies import get_audit
from deadlines.repositories.pg_deadlines import DeadlineRepository
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from evsk.domain.evsk import Evsk
from evsk.repositories.pg_evsk import EvskRepository
from infrastructure.contests.contest import ContestModel
from infrastructure.services.report_deadline import ReportDeadlineModel
from infrastructure.enums import QualificationKind, Role
from infrastructure.account.user import UserModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T

ZONE = "Asia/Yekaterinburg"
Kind = Literal["registration", "rank", "category", "antidoping", "governor", "report"]
REGISTRATION_DAYS = (3, 1)
GOVERNOR_DAYS = (30, 7, 1)
REPORT_DAYS = (7, 1, 0)
ANTIDOPING_DAYS = (30, 7, 0)
RANK_DAYS = 30
HORIZON_DAYS = 60


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo(ZONE)).date()


def local_day(moment: datetime) -> date:
    """Переводит момент времени в дату по Оренбургу."""
    return moment.astimezone(ZoneInfo(ZONE)).date()


def governor_due(on: date) -> date:
    """Возвращает ближайшее 1 февраля — срок ходатайств на премии Губернатора."""
    due = date(on.year, 2, 1)
    return due if due >= on else date(on.year + 1, 2, 1)


def age_on(birth: date, on: date) -> int:
    """Считает полных лет на дату."""
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def fits(contest: ContestModel, user: UserModel) -> bool:
    """Проверяет, подходит ли человек по возрастным группам соревнования на день старта."""
    if not contest.age_groups:
        return True
    age = age_on(user.birth_date, contest.starts_on)
    return any((group.min_age is None or age >= group.min_age) and (group.max_age is None or age <= group.max_age)
               for group in contest.age_groups)


def threshold(left: int, days: tuple[int, ...]) -> int | None:
    """Возвращает наименьший пройденный порог напоминания или None, если ни один не пройден."""
    passed = [value for value in days if left <= value]
    return min(passed) if passed else None


@dataclass(frozen=True, slots=True)
class DeadlineItem:
    kind: Kind
    title: str
    detail: str
    due: date
    link: str

    @property
    def days_left(self) -> int:
        """Дней до срока от сегодняшнего дня."""
        return (self.due - today()).days


class DeadlineWatcherCalendar:
    """Фоновый наблюдатель сроков: заявки, премии Губернатора, отчёты, разряды по ЕВСК и РУСАДА."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession],
                 notifications: Callable[[AsyncSession], Notifications], interval: int) -> None:
        """Сохраняет фабрику сессий, сборку уведомлений и интервал проверки."""
        self._sessions, self._notifications, self._interval = sessions, notifications, interval
        self._logger = logging.getLogger("fsp.deadlines")

    async def tick(self) -> int:
        """Проходит все источники сроков один раз и возвращает число отправленных напоминаний."""
        async with self._sessions() as db:
            repository, notifications = DeadlineRepository(db), self._notifications(db)
            sent = await self._registration(repository, notifications)
            sent += await self._governor(repository, notifications)
            sent += await self._reports(repository, notifications)
            sent += await self._antidoping(repository, notifications)
            sent += await self._ranks(db, repository, notifications)
            await db.commit()
        return sent

    async def run(self) -> None:
        """Бесконечно запускает проверку сроков с заданным интервалом; ошибки пишет в лог и продолжает."""
        while True:
            try:
                sent = await self.tick()
                if sent:
                    self._logger.info("Calendar reminders sent: %s", sent)
            except asyncio.CancelledError:
                raise
            except Exception:
                self._logger.exception("Calendar reminders failed")
            await asyncio.sleep(self._interval)

    async def _registration(self, repository: DeadlineRepository, notifications: Notifications) -> int:
        """Напоминает о закрытии приёма заявок подписанным и подходящим по возрасту, кто ещё не подал."""
        now = datetime.now(UTC)
        sent = 0
        for contest in await repository.closing(now, now + timedelta(days=max(REGISTRATION_DAYS))):
            closes = local_day(contest.registration_closes_at)
            step = threshold((closes - today()).days, REGISTRATION_DAYS)
            if step is None:
                continue
            applied = await repository.applied(contest.id)
            athletes = [user for user in await repository.candidates(contest.discipline_id, today())
                        if user.id not in applied and fits(contest, user)]
            when = f"{closes:%d.%m.%Y}"
            link = f"/competitions/{contest.id}"
            for user in athletes:
                if await repository.claim("registration", str(contest.id), user.id, step):
                    await notifications.deadline(
                        user.id, T.DEADLINE_REGISTRATION, "Скоро закроется приём заявок",
                        f"«{contest.title}»: заявки принимаются до {when}. Вы подходите по дисциплине и возрасту.", link,
                    )
                    sent += 1
            for coach_id, ids in (await repository.coaches([user.id for user in athletes], contest.discipline_id)).items():
                if await repository.claim("registration", str(contest.id), coach_id, step):
                    await notifications.deadline(
                        coach_id, T.DEADLINE_REGISTRATION, "Скоро закроется приём заявок",
                        f"«{contest.title}»: заявки до {when}. Ещё не заявлены ваши спортсмены: {len(ids)}.", link,
                    )
                    sent += 1
        return sent

    async def _governor(self, repository: DeadlineRepository, notifications: Notifications) -> int:
        """Напоминает федерации о сроке ходатайств на премии Губернатора."""
        due = governor_due(today())
        step = threshold((due - today()).days, GOVERNOR_DAYS)
        if step is None:
            return 0
        sent = 0
        for user_id in await repository.federation():
            if await repository.claim("governor", str(due.year), user_id, step):
                await notifications.deadline(
                    user_id, T.DEADLINE_GOVERNOR, "Ходатайства на премии Губернатора",
                    f"Срок подачи ходатайств — до {due:%d.%m.%Y}. Осталось {(due - today()).days} дн.",
                    "/cabinet/federation/deadlines",
                )
                sent += 1
        return sent

    async def _reports(self, repository: DeadlineRepository, notifications: Notifications) -> int:
        """Напоминает федерации о несданных отчётах из справочника отчётных сроков."""
        sent = 0
        federation = await repository.federation()
        for item in await repository.reports(include_done=False):
            step = threshold((item.due_on - today()).days, REPORT_DAYS)
            if step is None:
                continue
            for user_id in federation:
                if await repository.claim("report", str(item.id), user_id, step):
                    text = f"«{item.title}» — до {item.due_on:%d.%m.%Y}" + (f", {item.recipient}." if item.recipient else ".")
                    await notifications.deadline(user_id, T.DEADLINE_REPORT, "Срок отчёта", text,
                                                 "/cabinet/federation/deadlines")
                    sent += 1
        return sent

    async def _ranks(self, db: AsyncSession, repository: DeadlineRepository, notifications: Notifications) -> int:
        """Сообщает спортсменам и их тренерам, что по недавним местам можно подать на разряд по ЕВСК."""
        evsk = Evsk(UnitOfWork(db), EvskRepository(db), DictionaryRepository(db), get_audit(db))
        sent = 0
        for item in await evsk.recent(RANK_DAYS):
            key = f"{item.contest.id}:{item.rule.rank_type_id}"
            text = (f"«{item.contest.title}», {item.result.place} место: результат может соответствовать разряду "
                    f"«{item.rule.rank_type.name}». Подайте заявку, основание подставится из протокола.")
            if await repository.claim("evsk", key, item.user.id, 0):
                await notifications.deadline(item.user.id, T.RANK_POSSIBLE, "Можно подать на разряд", text,
                                             "/cabinet/athlete/rank")
                sent += 1
            coaches = await repository.coaches([item.user.id], item.contest.discipline_id)
            for coach_id in coaches:
                if await repository.claim("evsk", f"{key}:{item.user.id}", coach_id, 0):
                    who = f"{item.user.last_name} {item.user.first_name}: "
                    await notifications.deadline(coach_id, T.RANK_POSSIBLE, "Спортсмен может получить разряд",
                                                 who + text, "/cabinet/coach/ranks")
                    sent += 1
        return sent

    async def _antidoping(self, repository: DeadlineRepository, notifications: Notifications) -> int:
        """Напоминает спортсменам об истечении антидопингового курса РУСАДА."""
        sent = 0
        for item in await repository.antidoping(today() + timedelta(days=max(ANTIDOPING_DAYS))):
            step = threshold((item.valid_until - today()).days, ANTIDOPING_DAYS)
            if step is None or not await repository.claim("antidoping", str(item.id), item.user_id, step):
                continue
            text = (f"Сертификат курса РУСАДА действует до {item.valid_until:%d.%m.%Y}. Пройдите курс заново."
                    if step else "Сертификат курса РУСАДА истёк. Пройдите курс заново.")
            await notifications.deadline(item.user_id, T.ANTIDOPING_EXPIRING, "Антидопинговый курс", text,
                                         "/cabinet/athlete/profile")
            sent += 1
        return sent


class Deadlines:
    """Сроки человека по ролям и отчётные сроки федерации."""

    def __init__(self, uow: UnitOfWork, repository: DeadlineRepository, audit: Audit) -> None:
        """Сохраняет зависимости."""
        self._uow, self._repository, self._audit = uow, repository, audit

    async def mine(self, user_id: UUID, roles: frozenset[Role]) -> list[DeadlineItem]:
        """Собирает сроки, которые касаются человека в его ролях, по возрастанию даты."""
        now = today()
        horizon = now + timedelta(days=HORIZON_DAYS)
        items: list[DeadlineItem] = []
        user = await self._repository.user(user_id)
        if user is None:
            raise NotFound()
        own_ids = [user_id]
        coached = await self._repository.coach_athletes(user_id) if Role.COACH in roles else []
        if Role.ATHLETE in roles or Role.COACH in roles or Role.FEDERATION in roles:
            moment = datetime.combine(horizon, datetime.min.time(), ZoneInfo(ZONE))
            for contest in await self._repository.open_contests(moment):
                if Role.FEDERATION not in roles and Role.COACH not in roles and not fits(contest, user):
                    continue
                items.append(DeadlineItem("registration", contest.title, "Закрытие приёма заявок",
                                          local_day(contest.registration_closes_at), f"/competitions/{contest.id}"))
        for item in await self._repository.qualifications(own_ids + coached):
            if item.valid_until is None or item.valid_until > horizon or item.valid_until < now - timedelta(days=30):
                continue
            own = item.user_id == user_id
            kind: Kind = "category" if item.kind == QualificationKind.JUDGE_CATEGORY else "rank"
            if kind == "category" and Role.JUDGE not in roles:
                continue
            who = "" if own else f"{item.user.last_name} {item.user.first_name}: "
            title = f"{who}{item.item_name}"
            link = "/cabinet/judge/category" if kind == "category" else ("/cabinet/athlete/rank" if own else "/cabinet/coach/ranks")
            items.append(DeadlineItem(kind, title, "Окончание срока действия", item.valid_until, link))
        if Role.ATHLETE in roles:
            certificate = await self._repository.latest_antidoping(user_id)
            if certificate and certificate.valid_until <= horizon:
                items.append(DeadlineItem("antidoping", "Курс РУСАДА", "Окончание срока сертификата",
                                          certificate.valid_until, "/cabinet/athlete/profile"))
        if Role.FEDERATION in roles:
            due = governor_due(now)
            items.append(DeadlineItem("governor", "Ходатайства на премии Губернатора", "Указ № 93-ук от 04.03.2011",
                                      due, "/cabinet/federation/deadlines"))
            for report in await self._repository.reports(include_done=False):
                items.append(DeadlineItem("report", report.title, report.recipient or "Отчёт федерации", report.due_on,
                                          "/cabinet/federation/deadlines"))
        return sorted(items, key=lambda item: item.due)

    async def reports(self, include_done: bool) -> list[ReportDeadlineModel]:
        """Возвращает отчётные сроки федерации; сданные — по запросу."""
        return list(await self._repository.reports(include_done))

    async def save_report(
        self, actor_id: UUID, report_id: int | None, title: str, due_on: date, description: str | None,
        recipient: str | None, done: bool | None, ip: str | None,
    ) -> ReportDeadlineModel:
        """Создаёт или правит отчётный срок и пишет действие в журнал."""
        if not title.strip():
            raise ValidationFailed(fields={"title": ["Укажите название"]})
        if report_id is None:
            item = await self._repository.add(ReportDeadlineModel(title=title.strip(), due_on=due_on,
                                                                  description=description, recipient=recipient,
                                                                  created_by=actor_id))
        else:
            found = await self._repository.report(report_id)
            if found is None:
                raise NotFound()
            item = found
            item.title, item.due_on, item.description, item.recipient = title.strip(), due_on, description, recipient
        if done is not None:
            item.done_at = datetime.now(UTC) if done else None
        await self._audit.write(AuditAction.REPORT_DEADLINE_SAVE, actor_id, None, None,
                                {"id": item.id, "title": item.title, "due_on": due_on.isoformat(), "done": bool(item.done_at)}, ip)
        await self._uow.commit()
        return await self._repository.refresh(item)

    async def remove_report(self, report_id: int) -> None:
        """Удаляет отчётный срок или бросает NotFound."""
        item = await self._repository.report(report_id)
        if item is None:
            raise NotFound()
        await self._repository.remove(item)
        await self._uow.commit()
