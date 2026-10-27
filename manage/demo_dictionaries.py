from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.base import DictionaryColumns
from infrastructure.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionary_contest_format import DictionaryContestFormatModel
from infrastructure.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionary_contest_type import DictionaryContestTypeModel
from infrastructure.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionary_judge_category import DictionaryJudgeCategoryModel
from infrastructure.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.dictionary_organization_type import DictionaryOrganizationTypeModel
from infrastructure.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.enums import RankKind

SPORT, YOUTH, TITLE = RankKind.SPORT, RankKind.YOUTH, RankKind.TITLE


def names(*values: str) -> list[dict[str, Any]]:
    return [{"name": value} for value in values]


DEMO: list[tuple[type[DictionaryColumns], list[dict[str, Any]]]] = [
    (
        DictionaryDisciplineModel,
        [
            {"name": "Алгоритмическое программирование", "description": "Решение алгоритмических задач на время, индивидуально и в командах"},
            {"name": "Продуктовое программирование", "description": "Командная разработка программного продукта по кейсу с защитой"},
            {"name": "Программирование систем информационной безопасности", "description": "Соревнования в формате CTF"},
            {"name": "Программирование систем искусственного интеллекта", "description": "Задачи машинного обучения и анализа данных"},
            {"name": "Программирование робототехники", "description": "Программирование роботов для выполнения заданий на полигоне"},
            {"name": "Программирование беспилотных авиационных систем", "description": "Программирование автономных полётов БПЛА"},
            {"name": "Квизы", "description": "Командные интеллектуальные игры по ИТ-тематике"},
            {"name": "Олимпиадное программирование", "description": "Старое название алгоритмического программирования", "is_archived": True},
        ],
    ),
    (
        DictionaryMunicipalityModel,
        names(
            "г. Оренбург",
            "г. Орск",
            "г. Новотроицк",
            "г. Бузулук",
            "г. Бугуруслан",
            "г. Медногорск",
            "ЗАТО п. Комаровский",
            "Абдулинский городской округ",
            "Гайский городской округ",
            "Кувандыкский городской округ",
            "Соль-Илецкий городской округ",
            "Сорочинский городской округ",
            "Ясненский городской округ",
            "Адамовский район",
            "Акбулакский район",
            "Александровский район",
            "Асекеевский район",
            "Беляевский район",
            "Бугурусланский район",
            "Бузулукский район",
            "Грачёвский район",
            "Домбаровский район",
            "Илекский район",
            "Кваркенский район",
            "Красногвардейский район",
            "Курманаевский район",
            "Матвеевский район",
            "Новоорский район",
            "Новосергиевский район",
            "Октябрьский район",
            "Оренбургский район",
            "Первомайский район",
            "Переволоцкий район",
            "Пономарёвский район",
            "Сакмарский район",
            "Саракташский район",
            "Светлинский район",
            "Северный район",
            "Ташлинский район",
            "Тоцкий район",
            "Тюльганский район",
            "Шарлыкский район",
        ),
    ),
    (
        DictionaryOrganizationTypeModel,
        [
            {"name": "Общеобразовательная школа"},
            {"name": "Лицей / гимназия"},
            {"name": "Колледж / техникум", "description": "Среднее профессиональное образование"},
            {"name": "Вуз"},
            {"name": "Спортивная школа"},
            {"name": "Спортивный клуб"},
            {"name": "Компания", "description": "Коммерческая организация, в т. ч. организатор соревнований"},
            {"name": "Без организации", "description": "Спортсмен занимается самостоятельно"},
        ],
    ),
    (DictionaryAcademicGroupModel, names("1–4 классы", "5–9 классы", "10–11 классы", "Студенты")),
    (
        DictionaryAgeGroupModel,
        [
            {"name": "До 14 лет", "min_age": None, "max_age": 13},
            {"name": "14–17 лет", "min_age": 14, "max_age": 17},
            {"name": "18 лет и старше", "min_age": 18, "max_age": None},
        ],
    ),
    (
        DictionaryContestTypeModel,
        [
            {"name": "Чемпионат", "description": "Без ограничения по возрасту"},
            {"name": "Первенство", "description": "Для определённых возрастных групп"},
            {"name": "Кубок"},
            {"name": "Турнир"},
            {"name": "Фестиваль"},
        ],
    ),
    (
        DictionaryContestLevelModel,
        [
            {"name": "Региональное", "description": "Чемпионаты и первенства области и иные региональные"},
            {"name": "Межрегиональное", "description": "В том числе окружные (ПФО)"},
            {"name": "Всероссийское", "description": "Чемпионаты, первенства и кубки России"},
            {"name": "Международное"},
        ],
    ),
    (
        DictionaryContestFormatModel,
        [
            {"name": "Очно"},
            {"name": "Онлайн"},
            {"name": "Смешанный", "description": "Например, разработка онлайн, защита проектов очно"},
        ],
    ),
    (
        DictionaryRankTypeModel,
        [
            {"name": "Заслуженный мастер спорта России", "rank_kind": TITLE, "is_lifetime": True},
            {"name": "Мастер спорта России международного класса", "rank_kind": TITLE, "is_lifetime": True},
            {"name": "Мастер спорта России", "rank_kind": TITLE, "min_age": 16, "is_lifetime": True},
            {"name": "Кандидат в мастера спорта", "rank_kind": SPORT, "min_age": 15, "validity_months": 36},
            {"name": "Первый спортивный разряд", "rank_kind": SPORT, "min_age": 14, "validity_months": 24},
            {"name": "Второй спортивный разряд", "rank_kind": SPORT, "min_age": 14, "validity_months": 24},
            {"name": "Третий спортивный разряд", "rank_kind": SPORT, "min_age": 14, "validity_months": 24},
            {"name": "Первый юношеский спортивный разряд", "rank_kind": YOUTH, "min_age": 12, "validity_months": 24, "valid_until_age": 18},
            {"name": "Второй юношеский спортивный разряд", "rank_kind": YOUTH, "min_age": 12, "validity_months": 24, "valid_until_age": 18},
            {"name": "Третий юношеский спортивный разряд", "rank_kind": YOUTH, "min_age": 12, "validity_months": 24, "valid_until_age": 18},
        ],
    ),
    (
        DictionaryJudgeCategoryModel,
        [
            {"name": "Спортивный судья всероссийской категории", "validity_months": 48},
            {"name": "Спортивный судья первой категории", "validity_months": 48},
            {"name": "Спортивный судья второй категории", "validity_months": 24},
            {"name": "Спортивный судья третьей категории", "validity_months": 24},
            {"name": "Юный спортивный судья", "validity_months": None, "is_archived": True},
        ],
    ),
    (
        DictionaryJudgePositionModel,
        names("Главный судья", "Заместитель главного судьи", "Главный секретарь", "Заместитель главного секретаря", "Судья"),
    ),
]


async def seed(db: AsyncSession) -> None:
    for model, rows in DEMO:
        db.add_all(model(**row) for row in rows)
    await db.commit()
