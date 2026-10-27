# Технологический стек

## Фронтенд

| Что | Технология |
|---|---|
| Язык | TypeScript 6, строгий режим |
| Библиотека интерфейса | React 19 |
| Сборка и dev-сервер | Vite 8 |
| Стили | Tailwind CSS 4, свои токены двух тем по брендбуку ФСП |
| Маршрутизация | React Router 7 |
| Данные с сервера | TanStack Query 5 |
| Шрифты | JetBrains Mono, Roboto (`@fontsource`) |
| Компоненты | собственные (`src/shared/ui`), без UI-библиотек |
| Архитектура | Feature-Sliced Design: `app → pages → widgets → features → entities → shared` |
| Качество | ESLint (react-hooks, react-refresh, typescript-eslint), Prettier с сортировкой классов Tailwind, `tsc -b` |

## Бэкенд

| Что | Технология |
|---|---|
| Язык | Python 3.12 |
| Веб-фреймворк | FastAPI 0.115, сервер Uvicorn |
| Валидация | Pydantic 2, pydantic-settings |
| ORM и база | SQLAlchemy 2.0 в асинхронном режиме, драйвер asyncpg |
| Кэш и сессии | Redis (redis-py 5, асинхронный клиент) |
| Пароли | Argon2 (argon2-cffi) |
| Файлы | S3 API через клиент `minio` |
| Загрузка файлов | python-multipart |
| Проверка типов | Pyright, 0 ошибок |
| Архитектура | области (`auth`, `dictionaries`, `contests`, `applications`, `events`, `files`, `news`, `audit`), внутри слои `features → domain → repositories`; ORM-модели в `infrastructure/` |

## Инфраструктура

| Что | Технология |
|---|---|
| Контейнер | Docker, один образ на базе `python:3.12-slim` |
| База данных | PostgreSQL внутри контейнера |
| Кэш | Redis внутри контейнера |
| Файловое хранилище | SeaweedFS 4.51 с S3-совместимым API на порту 9000; бакеты `fsp-public` (анонимное чтение) и `fsp-private` (подписанные ссылки) |
| Запуск | `entrypoint.sh` поднимает PostgreSQL, Redis, SeaweedFS, создаёт схему, заливает демо-данные и запускает API |
| Управление | `manage/fsp.py`: собрать, запустить, остановить |
| Разработка фронта | Vite dev-сервер на порту 5173, прокси `/api` на API в Docker |
| Безопасность | cookie-сессия `sid`, CSRF-токен в заголовке `X-CSRF-Token`, роли проверяются на сервере |
| Репозиторий | Git, ветки по модулям, вливание в `main` одним коммитом |
