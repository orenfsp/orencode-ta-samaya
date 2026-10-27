# Правила бэкенда

Обязательно для всех, кто пишет в `backend/`, `infrastructure/`, `manage/`.

## Код

- Без докстрингов и комментариев. Только код.
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
- Аудит: значимые действия пишутся через `Audit.write(...)` в той же транзакции. Новые действия — в `audit/domain/actions.py`.
- Доменные классы называются по сущности, без суффикса «Service»: `Account`, `Roles`, `Sessions`, `Audit`, `Dictionary`, `Contest`, `Files`.
- Ошибки — наследники `AppError` из `core/errors.py`; новые дописываем в конец файла.

## Репозитории и хранилища

- Файл репозитория всегда с приставкой хранилища: `pg_` — Postgres, `red_` — Redis, `s3_` — MinIO.
- В папке сначала все `pg_`, потом `red_`, потом `s3_`.
- Ключи Redis: `<сущность>:<id...>:<постфикс>`. Постфиксы:
  - `:counter` — счётчик с окном, TTL ключа = окно;
  - `:token` — одноразовый токен с TTL;
  - `:cooldown` — флаг «уже было», TTL = период запрета.

## ORM

- Все модели — в `infrastructure/`, файлы подряд, по одной таблице на файл (`news_article.py`).
- Новые модели импортируются в `backend/main.py` и `manage/bootstrap.py` (там список импортов моделей).
- Перечисления для колонок — в `infrastructure/enums.py`.
- Критичные записи не удаляем физически: `is_archived` или статус.

## Демо-данные

- У каждой области свой файл `manage/demo_<область>.py` с функцией `async def seed(db: AsyncSession) -> None`.
- `manage/bootstrap.py` вызывает их по очереди — добавить одну строку.

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
