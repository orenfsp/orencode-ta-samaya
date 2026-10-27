# Ivan-001 — авторизация и RBAC (бэкенд)

Статус: черновик на согласование. Фронт не трогаем.

## 0. Принятые решения

- Монолит, FastAPI, SQLAlchemy 2.0 **async** (asyncpg), Redis (`redis.asyncio`), Pydantic v2.
- Один Docker-контейнер: Postgres + Redis + uvicorn внутри. Без volume — каждый запуск с нуля.
- Email = логин.
- Данные человека (ФИО, дата рождения) лежат прямо в `users`, отдельной сущности `persons` нет. Отчество nullable.
- ORM-модели отдельно от домена. Работа с БД и Redis — только через репозитории.
- Фича = папка `router.py` + `schemas.py`, полностью автономная: схемы не шарим между фичами, при необходимости дублируем.
- Домен, модели и репозитории — общие на область.
- Слои строго сверху вниз: `features → domain → repositories → models`. Роутер вызывает только домен, репозитории дёргает только домен.
- Без докстрингов и комментариев. Аргументы везде через `Annotated`.
- Схема БД создаётся `Base.metadata.create_all` на старте, без Alembic. Затем seed демо-данных.

## 1. Что такое consents и audit_log (на решение)

**Согласие на ПДн.** Кейс п. 9: «обязательное согласие на обработку персональных данных при регистрации и его хранение». Нужно хранить сам факт согласия: какую версию текста приняли и когда.
Предлагаю не делать отдельную таблицу, а положить в `users` два поля: `pd_consent_version`, `pd_consent_at`. Согласие родителя для <18 (PDF к заявке на соревнование) — это отдельная история, она будет в модуле заявок.

**audit_log.** Кейс п. 9 и P0 №12: «журнал действий: кто, когда и что сделал». Это одна таблица, куда пишется каждое значимое действие. Авторизация — первые события для журнала: регистрация, вход, выход, смена роли, решение по верификации, сброс пароля.
Предлагаю завести таблицу и writer сейчас: он маленький, и остальные модули будут сразу им пользоваться. Если хочешь — выкидываем из этой итерации (шаг 7 плана).

## 2. Роли и логика

Роли: `federation`, `organizer`, `athlete`, `coach`, `judge`.
Статусы роли: `pending`, `verified`, `rejected`.

У аккаунта не больше одной записи каждой роли: `unique(user_id, role)` в БД. Повторный запрос той же роли не создаёт новую запись — либо 409, либо `rejected → pending` в той же строке.

| Ситуация | Поведение |
|---|---|
| Регистрация | выбирается 1+ роль из `athlete / coach / judge / organizer / federation` |
| `athlete` | сразу `verified` |
| `coach` | доступ к кабинету сразу. Статус — это значок: `pending` ждёт проверки, `verified` = «верифицированный тренер», `rejected` = без значка, доступ остаётся |
| `judge`, `organizer`, `federation` | `pending`, без доступа к кабинету до решения федерации; по своей роли сотрудник ФСП не решает |
| Демо-федерация | создаётся seed-ом, сразу `verified` |
| Запрос новой роли позже | `POST /me/roles`; если роль была `rejected` — снова `pending`; если уже `pending` / `verified` — 409 |
| Отклонение | причина обязательна, сохраняется в `reject_reason` |
| Подтверждение / отклонение | действует сразу, без перелогина: домен перезаписывает роли во всех сессиях пользователя |

Активной роли нет. У пользователя до пяти вкладок — по одной на каждую `verified` роль; в каждой работают только эндпоинты этой роли (`/cabinets/coach`, `/admin/...` и т. д.).

Проверка прав только на сервере. Зависимость `current_user` до тела эндпоинта читает сессию из Redis и отдаёт `CurrentUser {id, email, roles}`; Postgres на проверку прав не трогается. `require_role(Role.X)` поверх неё → 401 без сессии, 403 если роли X нет среди `verified`. Подробно — в [001_api_map.md](001_api_map.md), раздел CurrentUser.

## 3. Сессии, CSRF, пароли

- Серверная сессия в Redis, в браузере httpOnly-кука `sid` (`SameSite=Lax`, `Secure` выключаем в демо по http).
- CSRF — double submit: при входе ставится читаемая кука `csrf_token`, на любой не-GET запрос с сессией нужен заголовок `X-CSRF-Token` с тем же значением. Не совпало — 403 `csrf_failed`.
- Пароль: ≥ 8 символов, есть строчная, заглавная, цифра (ТЗ + наша минимальная длина). `password == password_repeat`. Хеш argon2id (`argon2-cffi`).
- Rate limit входа: 5 неудачных попыток на `ip + email` за 15 минут → 429.
- Восстановление: токен 32 байта urlsafe, в Redis хранится sha256 от токена, TTL 1 ч, одноразовый. Ссылка на этом этапе пишется в лог контейнера (`docker logs`), SMTP подключим позже. После сброса закрываются все сессии пользователя.

Ключи Redis:

| Ключ | Значение | TTL |
|---|---|---|
| `session:{sid}` | json `{user_id, email, roles, csrf, created_at}` | 7 дней, продлевается при обращении |
| `user_sessions:{user_id}` | set из sid | 7 дней |
| `pwreset:{sha256}:token` | user_id | 1 ч |
| `login:{ip}:{email}:counter` | счётчик неудачных входов | 15 мин |
| `forgot:{email}:counter` | счётчик запросов сброса | 1 ч |

Постфиксы: `:counter` — счётчик с окном (TTL ключа = кулдаун), `:token` — одноразовый токен с TTL.

## 4. БД

### users
| Поле | Тип | |
|---|---|---|
| id | uuid pk | |
| email | varchar(255) unique | хранится в lower |
| password_hash | varchar(255) | |
| last_name | varchar(100) | |
| first_name | varchar(100) | |
| middle_name | varchar(100) null | |
| birth_date | date | |
| is_active | bool default true | |
| pd_consent_version | varchar(20) | |
| pd_consent_at | timestamptz | |
| created_at | timestamptz | |
| last_login_at | timestamptz null | |

### user_roles
| Поле | Тип | |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| role | enum role | |
| status | enum role_status | |
| reject_reason | text null | |
| decided_by | uuid fk users null | |
| decided_at | timestamptz null | |
| onboarding_done | bool default false | флаг навигатора из ТЗ |
| created_at | timestamptz | |
| | unique(user_id, role) | |

### audit_log (если оставляем)
| Поле | Тип |
|---|---|
| id | uuid pk |
| user_id | uuid null |
| action | varchar(50) |
| object_type | varchar(50) null |
| object_id | uuid null |
| payload | jsonb |
| ip | varchar(45) null |
| created_at | timestamptz |

Действия: `auth.register`, `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_reset_requested`, `auth.password_reset`, `role.request`, `role.approve`, `role.reject`, `role.reset`.

## 5. Структура

Правило: `features/<фича>/router.py → domain → repositories → infrastructure`. Роутер знает только домен и свои схемы. Домен знает репозитории и ничего не знает про HTTP. Репозитории — единственное место с SQLAlchemy-запросами и Redis-командами. ORM-модели живут в `infrastructure/` и в бэкенде не хранятся.

```
backend/
  core/                       общее: config.py, database.py (engine, UnitOfWork, DbSession), redis.py, request.py (ClientIp), errors.py, health.py
  auth/
    features/                 каждая фича = router.py + schemas.py; __init__.py собирает роутер области
      register/ login/ logout/ password_reset/ me/ role_verification/
    domain/                   password.py, accounts.py, sessions.py, roles.py (Roles + правила ролей)
    repositories/             pg_users.py, pg_user_roles.py, red_sessions.py (+ SessionData), red_login_attempts.py, red_forgot_requests.py, red_reset_tokens.py
                              приставка pg_ — Postgres, red_ — Redis; сначала все pg_, потом red_
    dependencies.py           сборка сервисов для FastAPI Depends + CurrentUser, require_role, куки
                              репозитории и домен отдают ORM-модели из infrastructure, отдельных сущностей нет
  audit/
    domain/                   actions.py, audit.py
    repositories/             pg_audit_log.py
    dependencies.py
  cabinets/
    features/                 federation/ organizer/ athlete/ coach/ judge/
    domain/                   cabinets.py
    dependencies.py
  main.py
  requirements.txt
infrastructure/               ORM, файлы подряд: base.py, enums.py, user.py, user_role.py, audit_log.py
manage/                       управление проектом: Dockerfile, Dockerfile.dockerignore, entrypoint.sh, fsp.py (меню),
                              bootstrap.py (пересоздание схемы + демо-данные), demo.py (демо-аккаунты)
docs/
frontend/
```

`dependencies.py` в каждой области — это сборка объектов для FastAPI: какие репозитории и сервисы создать на запрос. Роутер пишет `accounts: AccountDep` и получает готовый сервис.

Пустых `__init__.py` нет (namespace-пакеты), `__init__.py` есть только в `features/` — там собирается роутер области.

Пример цепочки для входа:

```python
@router.post("/auth/login")
async def login(
    body: Annotated[LoginIn, Body()],
    request: Request,
    response: Response,
    accounts: Annotated[Account, Depends(get_account)],
    sessions: Annotated[Sessions, Depends(get_sessions)],
) -> MeOut:
    user = await accounts.authenticate(body.email, body.password, request.client.host)
    session = await sessions.open(user)
    set_auth_cookies(response, session)
    return MeOut.from_entity(user)
```

Домен возвращает dataclass-сущности, а не ORM-объекты. Так ORM не протекает в фичи.

## 6. Контракт API

Полностью вынесен в [001_api_map.md](001_api_map.md): эндпоинты, схемы, ошибки и пошаговое описание по каждой фиче.

## 7. Демо-аккаунты

Пароль у всех `Demo1234`. Домен `example.test`, имена вымышленные.

| Email | Роли (статус) | Зачем |
|---|---|---|
| federation@example.test | federation (v) | основной админ |
| minister@example.test | federation (v) | второй аккаунт федерации |
| organizer@example.test | organizer (v) | |
| organizer.pending@example.test | organizer (p) | демо верификации |
| athlete@example.test | athlete (v) | студент, 20 лет |
| athlete.minor@example.test | athlete (v) | школьник, 14 лет |
| athlete.second@example.test | athlete (v) | школьница, 17 лет, демо заявок |
| athlete.third@example.test | athlete (v) | студент, демо команды тренера |
| pupil1@example.test, pupil2@example.test, pupil3@example.test | athlete (v) | школьники 15–16 лет без заявок: тренер записывает их на Первенство пачкой |
| coach@example.test | coach (v) | верифицированный тренер, со значком |
| coach.unverified@example.test | coach (p) | работает без значка, висит в очереди федерации |
| judge@example.test | judge (v) | |
| judge.pending@example.test | judge (p) | судья в очереди модерации |
| judge.rejected@example.test | judge (r, с причиной) | демо отклонения |
| athlete.coach@example.test | athlete (v), coach (v) | совмещённые роли |
| coach.judge@example.test | coach (v), judge (v) | совмещённые роли |

## 8. Запуск

- `python manage/fsp.py` — меню: 1) собрать / пересобрать, 2) запустить, 3) остановить.
- `manage/Dockerfile`: `python:3.12-slim` + `postgresql` + `redis-server`; в образ копируются `backend/`, `infrastructure/` и `manage/bootstrap.py` + `manage/demo.py` в `/app`, `PYTHONPATH=/app`. Контекст сборки — корень репо (`-f manage/Dockerfile .`), игнор — `manage/Dockerfile.dockerignore`.
- `manage/entrypoint.sh`: initdb → Postgres → БД → Redis → `python manage/bootstrap.py` → `uvicorn main:app`.
- Swagger: `http://localhost:8000/docs`. Для не-GET запросов — кнопка Authorize, значение куки `csrf_token`.

## 9. План

- [x] 1. Каркас: `requirements.txt`, `core/` (config, db, redis, errors, deps), `main.py`, `/health`
- [x] 2. Docker: `Dockerfile`, `entrypoint.sh`, `fsp.py`; проверить, что контейнер поднимается и `/health` отвечает
- [x] 3. Модели и репозитории auth: UserModel, UserRoleModel; репозитории users, user_roles, sessions, login_attempts, reset_tokens
- [x] 4. Домен auth: PasswordPolicy, PasswordHasher, Account, Sessions, Roles
- [x] 5. Фичи (router + schemas): register, login, logout, me (get, roles, onboarding)
- [x] 6. Фича password_reset: forgot, reset
- [x] 7. Аудит: модель, репозиторий, Audit, вызовы из доменных сервисов (можно вырезать)
- [x] 8. Верификация ролей федерацией: list, approve, reject
- [x] 9. Кабинеты-заглушки пяти ролей под `require_role`
- [x] 10. Seed демо-аккаунтов
- [x] 11. Прогон по Swagger / curl: регистрация → pending → федерация подтверждает → доступ без перелогина → 403 на чужой кабинет → logout → сброс пароля
