# Правила бэкенда

Обязательно для всех, кто пишет в `backend/`, `infrastructure/`, `manage/`.

## Код

- У каждой функции и метода — короткий докстринг по-русски, комментариев внутри кода нет. Репозитории — только запросы к хранилищу, логика — в домене. Подробно — [backend/RULES.md](../backend/RULES.md).
- Аргументы эндпоинтов — через `Annotated[...]` (`Body`, `Query`, `Path`, `Depends`).
- Python 3.12, SQLAlchemy 2.0 async, Pydantic v2, FastAPI.
- Проверка типов: `.venv/Scripts/pyright.exe` — 0 ошибок перед коммитом. Ruff не используем.

## Структура области

```
backend/<область>/
  repositories/      работа с хранилищами, единственное место с SQL / Redis / MinIO
  domain/            только классы с логикой (сервисы, политики)
  features/          каждая фича — папка router.py + schemas.py; __init__.py собирает роутер области
  dependencies.py    сборка сервисов для FastAPI Depends
```

- Слои строго сверху вниз: `features → domain → repositories → infrastructure`. Роутер вызывает только домен, репозитории вызывает только домен.
- Фичи автономны: схемы не шарим между фичами, при необходимости дублируем.
- Домен и репозитории возвращают ORM-модели из `infrastructure/` или простые кортежи. Отдельные классы-копии моделей не заводим.
- Доступ: `CurrentUserDep`, `require_role(Role.X)` из `auth.dependencies`. CSRF на не-GET проверяется автоматически.
- Транзакция: домен получает `UnitOfWork` и сам делает `commit()`.
- Аудит: значимые действия пишутся через `Audit.write(...)` в той же транзакции. Новые действия — в `audit/domain/actions.py` вместе с русским названием в `ACTION_LABELS`.
- Уведомления: только через `NotificationsDep` → `Notifications`, вызов до `commit()` в той же транзакции. Новый тип — в `notifications/domain/types.py` и метод с текстом в `Notifications`; письмо решает класс (`EMAIL_TYPES`). Каталог событий — [006_tz_notifications_audit.md](006_tz_notifications_audit.md).
- Доменные классы называются по сущности, без суффикса «Service»: `Account`, `Roles`, `Sessions`, `Audit`, `Dictionary`, `Contest`, `Files`.
- Ошибки — наследники `AppError` из `core/errors.py`; новые дописываем в конец файла.

## Репозитории и хранилища

- Репозиторий — только хранилище данных. Файл с приставкой хранилища: `pg_` — Postgres, `red_` — Redis, `s3_` — файлы (SeaweedFS).
- В папке сначала все `pg_`, потом `red_`, потом `s3_`.
- Внешние сервисы (почта, Telegram Bot API, Codeforces API) — не репозитории, а клиенты в папке `clients/` области: `notifications/clients/smtp.py`, `notifications/clients/telegram.py`, `people/clients/codeforces.py`.
- Ключи Redis: `<сущность>:<id...>:<постфикс>`. Постфиксы:
  - `:counter` — счётчик с окном, TTL ключа = окно;
  - `:token` — одноразовый токен с TTL;
  - `:cooldown` — флаг «уже было», TTL = период запрета.

## ORM

- Все модели — в `infrastructure/<группа>/`, по одной таблице на файл (`infrastructure/content/news_article.py`). Группы и что в них — [infrastructure/README.md](../infrastructure/README.md).
- Новую модель импортировать в `backend/main.py` (список импортов моделей). `manage/bootstrap.py` подхватывает все модели сам.
- Перечисления для колонок — в `infrastructure/enums.py`.
- Критичные записи не удаляем физически: `is_archived` или статус.

## Демо-данные

- Все демо-данные — один файл `manage/seed/seed.sql`, по разделам. Даты от `current_date`, ссылки по почте, названию или коду.
- Файлы лежат рядом по типам: `manage/seed/avatars`, `regulations`, `orders/qualifications`, `orders/squads`, `consents`. `object_key` в `files` — путь внутри `manage/seed`.
- `manage/bootstrap.py` при каждом старте пересоздаёт схему из моделей, выполняет `seed.sql`, кладёт файлы в хранилище и выпускает документы из `seed_documents` кодом приложения.
- Новая таблица с демо-данными — новый раздел в `seed.sql`; новый файл — в папку своего типа.

## Ветки

- `Имя-NNN` от `main`, вливаем обратно в `main`.
- Перед началом новой ветки — подтянуть свежий `main`.

## Места возможных конфликтов

| Файл | Правило |
|---|---|
| `backend/main.py` | одна строка `include_router` на область |
| `manage/bootstrap.py` | одна строка импорта модели и одна строка вызова seed |
| `backend/core/errors.py`, `backend/core/config.py` | только дописываем в конец |
| `backend/requirements.txt` | только дописываем |
| `docs/001_api_map.md` | общий; каждый пишет свой раздел, конфликты решаем при слиянии |
| `.vscode/settings.json` | новые правила сортировки — дописываем свой блок |
| `manage/Dockerfile`, `manage/entrypoint.sh`, `manage/fsp.py` | правит владелец инфраструктурной задачи (MinIO — ветка новостей) |
