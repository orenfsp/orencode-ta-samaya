from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.news_article import NewsArticleModel
from infrastructure.news_hashtag import NewsHashtagModel
from infrastructure.user import UserModel

DEMO = [
    {
        "slug": "itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu",
        "title": "Итоги регионального этапа по продуктовому программированию",
        "section": "Соревнования",
        "summary": "24 команды за 48 часов собрали сервисы для городских задач. Три лучшие едут на финал в Москву.",
        "hashtags": ["соревнования", "продуктовое"],
        "days_ago": 2,
        "blocks": [
            {"type": "text", "text": "Региональный этап прошёл в Технопарке ОГУ. Команды решали кейсы мэрии Оренбурга и двух ИТ-компаний области."},
            {"type": "heading", "text": "Победители", "level": 2},
            {"type": "text", "text": "1 место: «Ночные совы», сервис записи в секции.\n2 место: «Степь», учёт заявок ЖКХ.\n3 место: «Урал-Код», маршруты общественного транспорта."},
            {"type": "link", "url": "https://fsp-russia.ru/", "title": "Федерация спортивного программирования России"},
        ],
    },
    {
        "slug": "otkryt-nabor-v-sbornuyu-oblasti-po-algoritmicheskomu-programmirovaniyu",
        "title": "Открыт набор в сборную области по алгоритмическому программированию",
        "section": "Сборная",
        "summary": "Отбор пройдёт в два тура: онлайн-контест и очное собеседование с тренерами.",
        "hashtags": ["сборная", "алгоритмы"],
        "days_ago": 6,
        "blocks": [
            {"type": "text", "text": "Приглашаем школьников 8–11 классов и студентов. Онлайн-тур откроется 15 ноября и продлится 5 часов."},
            {"type": "heading", "text": "Как подать заявку", "level": 2},
            {"type": "text", "text": "Зарегистрируйтесь на сайте как спортсмен и запишитесь на соревнование «Отбор в сборную» в каталоге."},
        ],
    },
    {
        "slug": "seminar-dlya-trenerov-po-informatsionnoy-bezopasnosti",
        "title": "Семинар для тренеров по информационной безопасности",
        "section": "Обучение",
        "summary": "Разберём, как готовить команды к CTF: задачи, тренировочные площадки, распределение ролей.",
        "hashtags": ["тренерам", "ctf"],
        "days_ago": 11,
        "blocks": [
            {"type": "text", "text": "Семинар ведут судьи всероссийских соревнований по ИБ. Участие бесплатное, нужна регистрация в календаре событий."},
        ],
    },
    {
        "slug": "polozhenie-o-kubke-orenburgskoy-oblasti-2027",
        "title": "Положение о Кубке Оренбургской области 2027",
        "section": "Документы",
        "summary": "Проект положения на согласовании.",
        "hashtags": ["документы"],
        "days_ago": None,
        "blocks": [],
    },
]


async def seed(db: AsyncSession) -> None:
    author = await db.scalar(select(UserModel).where(UserModel.email == "federation@example.test"))
    tags = {
        name: NewsHashtagModel(name=name) for name in dict.fromkeys(tag for row in DEMO for tag in row["hashtags"])
    }
    now = datetime.now(UTC)
    for row in DEMO:
        published_at = now - timedelta(days=row["days_ago"]) if row["days_ago"] is not None else None
        db.add(
            NewsArticleModel(
                slug=row["slug"],
                title=row["title"],
                section=row["section"],
                summary=row["summary"],
                blocks=row["blocks"],
                status="published" if published_at else "draft",
                published_at=published_at,
                views=0,
                author_id=author.id if author else None,
                hashtags=[tags[name] for name in row["hashtags"]],
            )
        )
    await db.commit()
