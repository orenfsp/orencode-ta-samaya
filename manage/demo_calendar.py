from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.calendar_event import ORENBURG, CalendarEventModel
from infrastructure.user import UserModel

DEMO = [
    {
        "title": "Открытая лекция «Как начать в спортивном программировании»",
        "description": "Для школьников и родителей: дисциплины, соревнования, разряды и с чего начать.",
        "start": 10,
        "days": 1,
        "hours": (18, 20),
        "location": "г. Оренбург, ОГУ, конференц-зал",
        "status": "published",
    },
    {
        "title": "Учебно-тренировочные сборы сборной области",
        "description": "Подготовка кандидатов в сборную к всероссийским соревнованиям.",
        "start": 40,
        "days": 5,
        "hours": (9, 18),
        "location": "г. Оренбург, Технопарк",
        "status": "published",
    },
    {
        "title": "Вебинар для тренеров: работа с платформой ФСП",
        "description": "Как привязать спортсменов, подавать заявки и следить за сроками разрядов.",
        "start": 17,
        "days": 1,
        "hours": (16, 17),
        "is_online": True,
        "registration_url": "https://example.test/webinar",
        "status": "published",
    },
    {
        "title": "Отчётное собрание регионального отделения",
        "description": "Итоги сезона и планы на следующий год.",
        "start": 75,
        "days": 1,
        "hours": (11, 13),
        "location": "г. Оренбург",
        "status": "draft",
    },
]


async def seed(db: AsyncSession) -> None:
    author = await db.scalar(select(UserModel).where(UserModel.email == "federation@example.test"))
    today = date.today()
    for row in DEMO:
        starts = today + timedelta(days=row["start"])
        db.add(
            CalendarEventModel(
                title=row["title"],
                description=row["description"],
                starts_at=datetime.combine(starts, time(row["hours"][0]), ORENBURG),
                ends_at=datetime.combine(starts + timedelta(days=row["days"] - 1), time(row["hours"][1]), ORENBURG),
                location=row.get("location"),
                is_online=row.get("is_online", False),
                registration_url=row.get("registration_url"),
                status=row["status"],
                created_by=author.id if author else None,
            )
        )
    await db.commit()
