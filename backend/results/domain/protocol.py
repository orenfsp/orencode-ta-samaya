from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from zoneinfo import ZoneInfo
from uuid import UUID

from core import xlsx
from core.xlsx import Column
from infrastructure.account.user import UserModel
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import (
    CALENDAR_PLAN_TITLES,
    CONTEST_STATUS_TITLES,
    PARTICIPATION_TYPE_TITLES,
    VERIFICATION_STATUS_TITLES,
    ApplicationCreator,
    CalendarPlan,
)
from infrastructure.participation.contest_application import ContestApplicationModel
from infrastructure.participation.contest_result import ContestResultModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel

ZONE = ZoneInfo("Asia/Yekaterinburg")


def _name(user: UserModel) -> str:
    """Собирает фамилию, имя и отчество пользователя в одну строку."""
    return " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)


def _dates(starts: date, ends: date) -> str:
    """Форматирует одну дату или диапазон дат проведения соревнования."""
    return starts.strftime("%d.%m.%Y") if starts == ends else f"{starts:%d.%m.%Y} — {ends:%d.%m.%Y}"


@dataclass(frozen=True, slots=True)
class JudgeFile:
    judge: UserModel
    position: str
    kind: str
    name: str
    url: str
    comment: str
    removed: bool


class Protocol:
    """Итоговый протокол соревнования книгой Excel: места по каждому участнику, сведения, коллегия, документы, кандидаты на разряд."""

    RESULTS = (
        Column("Место", "center", 16),
        Column("Участник", width=34),
        Column("Команда", width=24),
        Column("Капитан", "center", 9),
        Column("Дата рождения", "center", 13),
        Column("Возрастная группа", width=16),
        Column("Академическая группа", width=18),
        Column("Муниципалитет", width=20),
        Column("Организация", "wrap", 30),
        Column("Тренер", width=26),
        Column("Баллы", "int", 8),
    )

    @classmethod
    def build(
        cls,
        contest: ContestModel,
        entries: Sequence[ContestApplicationModel],
        results: Sequence[ContestResultModel],
        judges: Sequence[JudgeAssignmentModel] = (),
        files: Sequence[JudgeFile] = (),
        ranks: Sequence[tuple[str, int, str]] = (),
        organizations: dict[UUID, str] | None = None,
        categories: dict[UUID, str] | None = None,
    ) -> bytes:
        """Строит xlsx-протокол: лист мест, лист сведений, коллегия с документами и кандидаты на разряд."""
        book = xlsx.book()
        place = ", ".join(part for part in (contest.municipality.name if contest.municipality else None, contest.venue) if part)
        sheet = xlsx.sheet(book, "Протокол")
        row = xlsx.header(
            sheet,
            f"Протокол: {contest.title}",
            [
                ("Дисциплина", contest.discipline.name),
                ("Даты проведения", _dates(contest.starts_on, contest.ends_on)),
                ("Место проведения", place or "—"),
                ("Верификация", VERIFICATION_STATUS_TITLES[contest.verification_status]),
            ],
        )
        by_user = {item.user_id: item for item in results}
        rows: list[tuple[tuple[int, int, str], list[object]]] = []
        for entry in entries:
            coach = _name(entry.creator) if entry.created_as == ApplicationCreator.COACH else ""
            for member in (item for item in entry.members if item.is_active):
                result = by_user.get(member.user_id)
                user = member.user
                place_value: object = "" if result is None else "Дисквалификация" if result.place is None else result.place
                group, rank = (2, 0) if result is None else (1, 0) if result.place is None else (0, result.place)
                rows.append(
                    (
                        (group, rank, entry.team_name or _name(user)),
                        [
                            place_value,
                            _name(user),
                            entry.team_name or "",
                            "да" if member.is_captain and entry.team_name else "",
                            user.birth_date,
                            member.age_group.name if member.age_group else "",
                            member.academic_group.name if member.academic_group else "",
                            user.municipality.name if user.municipality else "",
                            (organizations or {}).get(user.id, ""),
                            coach,
                            result.points if result else "",
                        ],
                    )
                )
        ordered = [values for _, values in sorted(rows, key=lambda item: item[0])]
        team = any(entry.team_name for entry in entries)
        keep = [index for index in range(len(cls.RESULTS)) if team or index not in (2, 3)]
        ordered = [[values[index] for index in keep] for values in ordered]
        ordered = [[index, *values] for index, values in enumerate(ordered, start=1)]
        placed = sum(1 for values in ordered if isinstance(values[1], int))
        row = xlsx.table(
            sheet,
            row,
            [Column("№", "int", 6), *[cls.RESULTS[index] for index in keep]],
            ordered,
            total=["Итого", "", f"{len(ordered)} участников, с местом: {placed}", *[""] * (len(keep) - 2)],
        )
        chief = next((item for item in judges if "главн" in item.position.name.lower() and "судь" in item.position.name.lower()), None)
        secretary = next((item for item in judges if "секретар" in item.position.name.lower()), None)
        xlsx.signatures(
            sheet,
            row,
            [
                ("Главный судья", _name(chief.judge) if chief else ""),
                ("Главный секретарь", _name(secretary.judge) if secretary else ""),
            ],
        )

        info = xlsx.sheet(book, "Соревнование")
        scale = ", ".join(f"{item['place']} место — {item['points']}" for item in contest.rating_points or [])
        prize = " · ".join(
            part for part in (contest.prize_fund_text, f"{contest.prize_fund_amount:,} ₽".replace(",", " ") if contest.prize_fund_amount else None) if part
        )
        plan = CALENDAR_PLAN_TITLES[contest.calendar_plan] + (
            f", № {contest.calendar_plan_number}" if contest.calendar_plan != CalendarPlan.NONE and contest.calendar_plan_number else ""
        )
        facts = [
            ("Название", contest.title),
            ("Описание", contest.description or "—"),
            ("Дисциплина", contest.discipline.name),
            ("Тип", contest.contest_type.name),
            ("Уровень", contest.contest_level.name),
            ("Календарный план", plan),
            ("Формат", contest.contest_format.name),
            ("Участие", PARTICIPATION_TYPE_TITLES[contest.participation_type]),
            ("Размер команды", f"{contest.team_size_min}–{contest.team_size_max}" if contest.team_size_max else "—"),
            ("Возрастные группы", ", ".join(item.name for item in contest.age_groups) or "без ограничений"),
            ("Академические группы", ", ".join(item.name for item in contest.academic_groups) or "без ограничений"),
            ("Начало", contest.starts_on),
            ("Окончание", contest.ends_on),
            ("Приём заявок", f"{contest.registration_opens_at.astimezone(ZONE):%d.%m.%Y %H:%M} — {contest.registration_closes_at.astimezone(ZONE):%d.%m.%Y %H:%M}"),
            ("Место проведения", place or "—"),
            ("Организатор", _name(contest.organizer)),
            ("Почта организатора", contest.organizer.email),
            ("Положение", contest.regulations.original_name if contest.regulations else "—"),
            ("Причина отмены", contest.cancel_reason or "—"),
            ("Комментарий верификации", contest.verification_reason or "—"),
            ("Статус", CONTEST_STATUS_TITLES[contest.status]),
            ("Верификация", VERIFICATION_STATUS_TITLES[contest.verification_status]),
            ("Баллы за места", scale or "—"),
            ("Призовой фонд", prize or "—"),
            ("Заявок одобрено", len(entries)),
        ]
        row = xlsx.header(info, "Сведения о соревновании")
        xlsx.table(info, row, [Column("Поле", width=26), Column("Значение", "wrap", 90)], [list(item) for item in facts], freeze=True)

        panel = xlsx.sheet(book, "Судейская коллегия")
        row = xlsx.header(panel, "Судейская коллегия", [("Соревнование", contest.title)])
        row = xlsx.table(
            panel,
            row,
            [Column("№", "center", 5), Column("Должность", width=28), Column("Судья", width=34), Column("Категория", "wrap", 30), Column("Муниципалитет", width=22)],
            [
                [index, item.position.name, _name(item.judge), (categories or {}).get(item.judge_id, "—"), item.judge.municipality.name if item.judge.municipality else ""]
                for index, item in enumerate(judges, start=1)
            ],
            empty="Коллегия не назначена",
        )
        documents = xlsx.sheet(book, "Документы судей")
        row = xlsx.header(documents, "Документы судейской коллегии", [("Соревнование", contest.title)])
        head = row
        xlsx.table(documents, row, [Column("Вид", width=18), Column("Судья", width=34), Column("Должность и комментарий", "wrap", 40), Column("Файл", width=36)], [[item.kind, _name(item.judge) + (" (снят)" if item.removed else ""), " · ".join(part for part in (item.position, item.comment) if part), item.name] for item in files], empty="Документов нет")
        for offset, item in enumerate(files, start=1):
            xlsx.link(documents, head + offset, 4, item.url, item.name)

        candidates = xlsx.sheet(book, "Кандидаты на разряд")
        row = xlsx.header(candidates, "Могут претендовать на разряд по ЕВСК", [("Соревнование", contest.title)])
        xlsx.table(
            candidates,
            row,
            [Column("Место", "center", 8), Column("Спортсмен", width=34), Column("Разряд", width=36)],
            [[place_value, name, rank] for name, place_value, rank in ranks],
        )
        return xlsx.save(book)
