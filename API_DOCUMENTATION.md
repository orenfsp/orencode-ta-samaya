# Карта API

Бэкенд платформы ФСП Оренбургской области: 339 эндпоинтов, база `/api/v1`. Документ собран из OpenAPI-спецификации работающего приложения. Примеры ответов GET-запросов — настоящие ответы демо-стенда (длинные списки сокращены до одного элемента), примеры тел — по схемам валидации. Интерактивно всё можно вызвать в Swagger: `http://localhost:8000/docs`.

## Общие правила

**Сессия.** `POST /auth/login` ставит две cookie: `sid` (HttpOnly, сессия в Redis на 7 дней) и `csrf_token`. Каждый изменяющий запрос (POST, PUT, PATCH, DELETE) с сессией передаёт значение `csrf_token` в заголовке `X-CSRF-Token`, иначе 403 `csrf_failed`.

```bash
curl -c jar -H 'Content-Type: application/json' -d '{"email":"federation@example.test","password":"Demo1234"}' http://localhost:8000/api/v1/auth/login
curl -b jar -H "X-CSRF-Token: $(grep csrf_token jar | cut -f7)" -X POST http://localhost:8000/api/v1/notifications/read-all
```

**Ошибки** — всегда в одном формате:

```json
{"error": {"code": "validation_error", "message": "Проверьте поля", "fields": {"reason": ["Опишите, с чем вы не согласны"]}}}
```

| HTTP | Типичные `code` | Когда |
|---|---|---|
| 400 | `invalid_token`, `invalid_code` | Неверный или просроченный токен, код из письма |
| 401 | `unauthorized`, `invalid_credentials` | Нет сессии, неверный пароль |
| 403 | `forbidden`, `csrf_failed`, `account_disabled` | Нет роли или прав на объект, нет CSRF-заголовка |
| 404 | `not_found` | Объекта нет или он скрыт от этой роли |
| 409 | `invalid_status`, `already_pending`, `not_higher`, `category_not_valid`, `already_assigned`, `appeal_exists`, `appeal_closed`, `link_exists`, `in_use`, `name_taken`, `points_locked`, `registration_closed` | Действие недопустимо в текущем состоянии |
| 413 | `file_too_large` | Файл больше 10 МБ |
| 415 | `unsupported_file_type` | Тип файла не из списка |
| 422 | `validation_error` | Ошибки полей в `fields` |
| 429 | `too_many_attempts` | Лимит попыток входа или кодов; заголовок `Retry-After` |

**Списки** отдают `{"items": [...], "total": N}` с параметрами `limit` и `offset`. **Даты** — `YYYY-MM-DD`, моменты — ISO 8601 с часовым поясом; «сегодня» считается по Оренбургу (UTC+5).

**Роли:** спортсмен (`athlete`), тренер (`coach`), судья (`judge`), организатор (`organizer`), сотрудник федерации (`federation`). Пути `/admin/*` — только федерация, `/organizer/*` — только организатор своего соревнования. Демо-аккаунты и пароль `Demo1234` — в корневом README.

## Разделы

- [Аккаунт и вход](#аккаунт-и-вход) — 25
- [Люди и профиль](#люди-и-профиль) — 17
- [Организации и реестр](#организации-и-реестр) — 12
- [Спортивная подготовка: программы, группы, журнал, нормативы](#спортивная-подготовка-программы-группы-журнал-нормативы) — 27
- [Справочники](#справочники) — 12
- [Справочники: управление федерацией](#справочники-управление-федерацией) — 66
- [Соревнования](#соревнования) — 35
- [Календарь и события](#календарь-и-события) — 7
- [Заявки](#заявки) — 29
- [Места и протокол](#места-и-протокол) — 9
- [Рейтинг и сборные](#рейтинг-и-сборные) — 12
- [Документы и отчёты](#документы-и-отчёты) — 15
- [Судьи, разряды и ЕВСК](#судьи-разряды-и-евск) — 27
- [Апелляции и нарушения](#апелляции-и-нарушения) — 10
- [Сроки](#сроки) — 6
- [Уведомления и Telegram](#уведомления-и-telegram) — 14
- [Журнал, аналитика, файлы, новости](#журнал-аналитика-файлы-новости) — 16

## Аккаунт и вход

### `POST /auth/register`

**Register**. Регистрирует нового пользователя и открывает для него сессию.

- Доступ: без входа

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `email` | string | да |  |
| `password` | string | да |  |
| `password_repeat` | string | да |  |
| `last_name` | string | да | длина ≥ 1; длина ≤ 100 |
| `first_name` | string | да | длина ≥ 1; длина ≤ 100 |
| `middle_name` | string или null | нет | длина ≥ 1; длина ≤ 100 |
| `birth_date` | string | да |  |
| `roles` | array | да |  |
| `pd_consent` | boolean | да |  |

```json
{
  "email": "строка",
  "password": "строка",
  "password_repeat": "строка",
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15",
  "roles": [
    "federation"
  ],
  "pd_consent": true
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "строка",
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15",
  "roles": [
    {
      "role": "federation",
      "status": "pending",
      "reject_reason": "строка",
      "onboarding_done": true,
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ]
}
```

### `POST /auth/login`

**Login**. Аутентифицирует пользователя и открывает сессию с куками.

- Доступ: без входа

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `email` | string | да | длина ≥ 1; длина ≤ 255 |
| `password` | string | да | длина ≥ 1; длина ≤ 128 |

```json
{
  "email": "строка",
  "password": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "строка",
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15",
  "roles": [
    {
      "role": "federation",
      "status": "pending",
      "reject_reason": "строка",
      "onboarding_done": true,
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ]
}
```

### `GET /me`

**Get Me**. Возвращает профиль текущего пользователя.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me`:

```json
{
  "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
  "email": "athlete@example.test",
  "email_verified": true,
  "last_name": "Соколов",
  "first_name": "Артём",
  "middle_name": "Игоревич",
  "birth_date": "2006-03-01",
  "academic_group": {
    "id": 4,
    "name": "Студенты"
  },
  "roles": [
    {
      "role": "athlete",
      "status": "verified",
      "reject_reason": null,
      "onboarding_done": false,
      "created_at": "2026-10-28T14:21:27.848354Z"
    }
  ],
  "available_roles": [
    "athlete"
  ],
  "codeforces": {
    "handle": "tourist",
    "url": "https://codeforces.com/profile/tourist",
    "rating": 3382,
    "max_rating": 4009,
    "rank": "legendary grandmaster",
    "status": "ok",
    "updated_at": "2026-10-28T14:21:48.268572Z"
  }
}
```

### `PATCH /me`

**Update Me**. Обновляет переданные поля профиля текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `academic_group_id` | integer или null | нет | ≥ 1 |
| `last_name` | string или null | нет | длина ≥ 1; длина ≤ 100 |
| `first_name` | string или null | нет | длина ≥ 1; длина ≤ 100 |
| `middle_name` | string или null | нет | длина ≤ 100 |
| `birth_date` | string или null | нет |  |

```json
{
  "academic_group_id": 1,
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "строка",
  "email_verified": true,
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15",
  "academic_group": {
    "id": 1,
    "name": "строка"
  },
  "roles": [
    {
      "role": "federation",
      "status": "pending",
      "reject_reason": "строка",
      "onboarding_done": true,
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ],
  "available_roles": [
    "federation"
  ],
  "codeforces": {
    "handle": "строка",
    "url": "строка",
    "rating": 1,
    "max_rating": 1,
    "rank": "строка",
    "status": "pending",
    "updated_at": "2026-11-15T12:00:00+05:00"
  }
}
```

### `POST /me/roles`

**Request Role**. Запрашивает у текущего пользователя новую роль.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `role` | string | да | значения: `federation`, `organizer`, `athlete`, `coach`, `judge` |

```json
{
  "role": "federation"
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "строка",
  "email_verified": true,
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15",
  "academic_group": {
    "id": 1,
    "name": "строка"
  },
  "roles": [
    {
      "role": "federation",
      "status": "pending",
      "reject_reason": "строка",
      "onboarding_done": true,
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ],
  "available_roles": [
    "federation"
  ],
  "codeforces": {
    "handle": "строка",
    "url": "строка",
    "rating": 1,
    "max_rating": 1,
    "rank": "строка",
    "status": "pending",
    "updated_at": "2026-11-15T12:00:00+05:00"
  }
}
```

### `POST /me/roles/{role}/onboarding`

**Complete Onboarding**. Отмечает завершение онбординга для роли текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `role` | путь | string | да |  | значения: `federation`, `organizer`, `athlete`, `coach`, `judge` |

Ответ `204` — без тела.

### `POST /me/email/verify/send`

**Отправить код подтверждения почты**. Отправляет пользователю код подтверждения почты.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `204` — без тела.

### `POST /me/email/verify`

**Подтвердить почту кодом**. Подтверждает почту пользователя кодом.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `code` | string | да | формат `^\d{6}$` |

```json
{
  "code": "строка"
}
```

Ответ `204` — без тела.

### `POST /me/email/change`

**Отправить код на новую почту**. Запрашивает смену почты: проверяет пароль и отправляет код на новый адрес.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `new_email` | string | да | длина ≤ 255; формат `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| `password` | string | да | длина ≥ 1; длина ≤ 200 |

```json
{
  "new_email": "строка",
  "password": "строка"
}
```

Ответ `204` — без тела.

### `POST /me/email/change/confirm`

**Подтвердить новую почту кодом**. Подтверждает смену почты кодом и открывает новую сессию с обновлённым адресом.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `code` | string | да | формат `^\d{6}$` |

```json
{
  "code": "строка"
}
```

Ответ `204` — без тела.

### `POST /auth/logout`

**Logout**. Закрывает сессию пользователя, если она есть, и удаляет куки.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `204` — без тела.

### `POST /auth/password/forgot`

**Отправить код на почту**. Отправляет код восстановления пароля на почту.

- Доступ: без входа

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `email` | string | да | длина ≥ 1; длина ≤ 255 |

```json
{
  "email": "строка"
}
```

Ответ `202`:

```json
null
```

### `POST /auth/password/verify`

**Проверить код и получить токен смены пароля**. Проверяет код восстановления и возвращает токен для смены пароля.

- Доступ: без входа

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `email` | string | да | длина ≥ 1; длина ≤ 255 |
| `code` | string | да | формат `^\d{6}$` |

```json
{
  "email": "строка",
  "code": "строка"
}
```

Ответ `200`:

```json
{
  "reset_token": "строка"
}
```

### `POST /auth/password/reset`

**Задать новый пароль**. Устанавливает новый пароль по токену и завершает текущую сессию.

- Доступ: без входа

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `token` | string | да | длина ≥ 1; длина ≤ 128 |
| `password` | string | да |  |
| `password_repeat` | string | да |  |

```json
{
  "token": "строка",
  "password": "строка",
  "password_repeat": "строка"
}
```

Ответ `204` — без тела.

### `GET /admin/role-requests`

**List Role Requests**. Список заявок на роли с фильтрами по статусу, роли и поиску.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `state` | query | string | нет |  | значения: `pending`, `decided` |
| `status` | query | string | нет |  | значения: `pending`, `verified`, `rejected` |
| `role` | query | string | нет |  | значения: `federation`, `organizer`, `athlete`, `coach`, `judge` |
| `search` | query | string | нет |  | длина ≤ 200 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/role-requests`:

```json
{
  "items": [
    {
      "id": "c0dc26ab-5049-4b8a-89d0-71b80a1b482e",
      "user": {
        "id": "dac7dab6-e718-4899-8670-43ed0ea10ed4",
        "email": "judge.pending@example.test",
        "last_name": "Лебедев",
        "first_name": "Максим",
        "middle_name": "Андреевич",
        "birth_date": "1991-04-22"
      },
      "role": "judge",
      "status": "pending",
      "reject_reason": null,
      "created_at": "2026-10-28T14:21:27.848354Z",
      "decided_at": null,
      "decided_by": null
    },
    "…ещё элементы"
  ],
  "total": 12
}
```

### `GET /admin/role-requests/counts`

**Count Role Requests**. Количество заявок в ожидании по каждой модерируемой роли.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/role-requests/counts`:

```json
{
  "pending": {
    "judge": 1,
    "federation": 0,
    "coach": 1,
    "organizer": 1
  }
}
```

### `POST /admin/role-requests/{request_id}/approve`

**Approve Role Request**. Одобряет заявку на роль.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `request_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "role": "federation",
  "status": "pending",
  "reject_reason": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка"
  }
}
```

### `POST /admin/role-requests/{request_id}/reject`

**Reject Role Request**. Отклоняет заявку на роль с указанием причины.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `request_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "role": "federation",
  "status": "pending",
  "reject_reason": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка"
  }
}
```

### `POST /admin/role-requests/{request_id}/reset`

**Reset Role Request**. Возвращает решённую заявку на роль в состояние ожидания.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `request_id` | путь | string | да |  |  |

Тело запроса:

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "role": "federation",
  "status": "pending",
  "reject_reason": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка"
  }
}
```

### `GET /me/guardian-consent`

**Нужно ли согласие и его состояние**. Нужно ли согласие текущему пользователю и его текущее состояние.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/guardian-consent`:

```json
{
  "required": false,
  "consent": null
}
```

### `PUT /me/guardian-consent`

**Загрузить или заменить согласие**. Загружает или заменяет согласие представителя текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `guardian_name` | string | да | длина ≥ 1; длина ≤ 300 |
| `guardian_phone` | string | да | длина ≥ 1; длина ≤ 40; формат `^[0-9+()\- ]{5,40}$` |
| `file_id` | string | да |  |

```json
{
  "guardian_name": "строка",
  "guardian_phone": "строка",
  "file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "guardian_name": "строка",
  "guardian_phone": "строка",
  "file": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "original_name": "строка",
    "url": "строка"
  },
  "status": "pending",
  "status_title": "строка",
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00"
}
```

### `GET /admin/guardian-consents`

**Согласия: сначала на проверке**. Страница согласий на модерации: сначала ожидающие решения.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `status` | query | string | нет |  | значения: `pending`, `approved`, `rejected` |
| `search` | query | string | нет |  | длина ≤ 200 |
| `limit` | query | integer | нет | `30` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/guardian-consents`:

```json
{
  "items": [
    {
      "id": "0c70124b-cfac-407d-8c0e-efc4a34256e3",
      "person": {
        "id": "9202ecc8-93bf-4633-9219-6ea8ee6aee79",
        "full_name": "Морозова Дарья Ильинична",
        "email": "athlete.second@example.test",
        "birth_date": "2009-09-01"
      },
      "guardian_name": "Морозова Ирина Сергеевна",
      "guardian_phone": "+7 912 345-10-01",
      "file": {
        "id": "bdf52305-958c-43d3-bce1-eafef89a507e",
        "original_name": "athlete.second.pdf",
        "url": "/api/v1/files/bdf52305-958c-43d3-bce1-eafef89a507e"
      },
      "status": "pending",
      "status_title": "На проверке",
      "reject_reason": null,
      "submitted_at": "2026-10-28T14:21:27.848354Z",
      "decided_at": null
    },
    "…ещё элементы"
  ],
  "total": 25
}
```

### `GET /admin/guardian-consents/count`

**Сколько согласий ждёт решения**. Количество согласий, ждущих решения.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/guardian-consents/count`:

```json
{
  "pending": 1
}
```

### `POST /admin/guardian-consents/{consent_id}/approve`

**Одобрить**. Одобряет согласие.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `consent_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "person": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "строка",
    "email": "строка",
    "birth_date": "2026-11-15"
  },
  "guardian_name": "строка",
  "guardian_phone": "строка",
  "file": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "original_name": "строка",
    "url": "строка"
  },
  "status": "pending",
  "status_title": "строка",
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00"
}
```

### `POST /admin/guardian-consents/{consent_id}/reject`

**Отклонить с причиной**. Отклоняет согласие с указанием причины.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `consent_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "person": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "строка",
    "email": "строка",
    "birth_date": "2026-11-15"
  },
  "guardian_name": "строка",
  "guardian_phone": "строка",
  "file": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "original_name": "строка",
    "url": "строка"
  },
  "status": "pending",
  "status_title": "строка",
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00"
}
```

## Люди и профиль

### `GET /people/{user_id}`

**Публичная страница человека**. Отдаёт публичную страницу человека с учётом прав зрителя.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /people/bc167364-0988-4783-8e6c-5fb9d55162e8`:

```json
{
  "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
  "name": "Соколов Артём Игоревич",
  "last_name": "Соколов",
  "first_name": "Артём",
  "middle_name": "Игоревич",
  "birth_date": "2006-03-01",
  "academic_group": {
    "id": 4,
    "name": "Студенты"
  },
  "avatar_url": "http://localhost:9100/fsp-public/avatars/athlete.jpg",
  "roles": [
    "athlete"
  ],
  "is_owner": true,
  "masked": false,
  "codeforces": {
    "handle": "tourist",
    "url": "https://codeforces.com/profile/tourist",
    "rating": 3382,
    "max_rating": 4009,
    "rank": "legendary grandmaster",
    "status": "ok",
    "updated_at": "2026-10-28T14:21:48.268572Z"
  }
}
```

### `GET /people/{user_id}/avatar`

**Фото человека: переадресация на файл, 404 — фото нет**. Переадресует на фото человека; браузер держит ответ пять минут, чтобы списки не дёргали API.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Ответ `200`:

```json
null
```

### `PATCH /me/page`

**Настройки своей страницы**. Обновляет аватар страницы текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `avatar_file_id` | string или null | нет |  |

```json
{
  "avatar_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "строка",
  "last_name": "строка",
  "first_name": "строка",
  "middle_name": "строка",
  "birth_date": "2026-11-15",
  "academic_group": {
    "id": 1,
    "name": "строка"
  },
  "avatar_url": "строка",
  "roles": [
    "federation"
  ],
  "is_owner": true,
  "masked": true,
  "codeforces": {
    "handle": "строка",
    "url": "строка",
    "rating": 1,
    "max_rating": 1,
    "rank": "строка",
    "status": "pending",
    "updated_at": "2026-11-15T12:00:00+05:00"
  }
}
```

### `GET /people/{user_id}/wall`

**Лента человека по роли**. Отдаёт страницу ленты человека в выбранной роли.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |
| `role` | query | string | да |  | значения: `athlete`, `coach`, `judge`, `organizer` |
| `limit` | query | integer | нет | `10` | ≥ 1, ≤ 50 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200`:

```json
{
  "items": [
    {
      "contest": {
        "id": 1,
        "title": "строка",
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "contest_level": {
          "id": 1,
          "name": "строка"
        },
        "contest_format": {
          "id": 1,
          "name": "строка"
        },
        "participation_type": "individual",
        "starts_on": "2026-11-15",
        "ends_on": "2026-11-15",
        "status": "draft"
      },
      "team_name": "строка",
      "athletes": 1,
      "place": 1,
      "disqualified": true,
      "position": "строка",
      "post": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "text": "строка",
        "photos": [
          {
            "id": "…",
            "url": "…"
          }
        ],
        "is_hidden": true,
        "hidden_by_federation": true
      }
    }
  ],
  "total": 1
}
```

### `PUT /me/wall/{role}/{contest_id}`

**Дописать пост к соревнованию**. Сохраняет или обновляет пост текущего пользователя о соревновании.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `role` | путь | string | да |  | значения: `athlete`, `coach`, `judge`, `organizer` |
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `text` | string или null | нет | длина ≤ 2000 |
| `photo_ids` | array | нет | элементов ≤ 10 |
| `is_hidden` | boolean | нет |  |

```json
{
  "text": "строка",
  "photo_ids": [],
  "is_hidden": false
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest_id": 1,
  "text": "строка",
  "is_hidden": true
}
```

### `PATCH /admin/wall-posts/{post_id}`

**Скрыть или вернуть пост**. Скрывает или возвращает пост стены решением федерации.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `post_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `hidden_by_federation` | boolean | да |  |

```json
{
  "hidden_by_federation": true
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "hidden_by_federation": true
}
```

### `PUT /me/codeforces`

**Сохранить хэндл и сразу обновить рейтинг**. Привязывает хэндл Codeforces текущему пользователю и возвращает обновлённый профиль.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `handle` | string | да |  |

```json
{
  "handle": "строка"
}
```

Ответ `200`:

```json
{
  "handle": "строка",
  "url": "строка",
  "rating": 1,
  "max_rating": 1,
  "rank": "строка",
  "status": "pending",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `DELETE /me/codeforces`

**Убрать хэндл**. Отвязывает хэндл Codeforces текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `204` — без тела.

### `GET /me/sport-profile`

**Спортивный профиль**. Возвращает спортивный профиль текущего пользователя.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/sport-profile`:

```json
{
  "municipality": {
    "id": 31,
    "name": "Оренбургский район"
  },
  "sex": "male",
  "organization": {
    "id": 3,
    "name": "ФГБОУ ВО «Оренбургский государственный университет»"
  },
  "no_organization": false,
  "start_year": 2022,
  "training_stage": {
    "value": "highest",
    "title": "Высшее спортивное мастерство"
  },
  "disciplines": [
    {
      "id": 2,
      "name": "Продуктовое программирование"
    },
    "…ещё элементы"
  ],
  "organization_history": [
    {
      "organization": "ФГБОУ ВО «Оренбургский государственный университет»",
      "valid_from": "2025-06-15",
      "valid_to": null
    },
    "…ещё элементы"
  ],
  "coaches": [],
  "antidoping": [
    {
      "id": "d9d223f2-0388-4400-b0a2-1f60085fa98f",
      "passed_on": "2025-11-12",
      "valid_until": "2026-11-12",
      "certificate_url": "https://rusada.ru/education/online-training/",
      "file_url": null
    }
  ]
}
```

### `PUT /me/sport-profile`

**Сохранить спортивный профиль**. Сохраняет спортивный профиль текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `municipality_id` | integer или null | нет | ≥ 1 |
| `sex` | string или null | нет | значения: `male`, `female` |
| `organization_id` | integer или null | нет | ≥ 1 |
| `no_organization` | boolean | нет |  |
| `start_year` | integer или null | нет |  |
| `training_stage` | string или null | нет | значения: `initial`, `training`, `improvement`, `highest` |
| `discipline_ids` | array | нет | элементов ≤ 10 |

```json
{
  "municipality_id": 1,
  "sex": "male",
  "organization_id": 1,
  "no_organization": false,
  "start_year": 1,
  "training_stage": "initial",
  "discipline_ids": [
    1
  ]
}
```

Ответ `200`:

```json
{
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "sex": "male",
  "organization": {
    "id": 1,
    "name": "строка"
  },
  "no_organization": true,
  "start_year": 1,
  "training_stage": {
    "value": "initial",
    "title": "строка"
  },
  "disciplines": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "organization_history": [
    {
      "organization": "строка",
      "valid_from": "2026-11-15",
      "valid_to": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "status": "requested",
      "status_title": "строка",
      "created_at": "2026-11-15T12:00:00+05:00",
      "updated_at": "2026-11-15T12:00:00+05:00",
      "events": [
        {
          "status": "requested",
          "status_title": "строка",
          "actor": "строка",
          "comment": "строка",
          "created_at": "2026-11-15T12:00:00+05:00"
        }
      ]
    }
  ],
  "antidoping": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "passed_on": "2026-11-15",
      "valid_until": "2026-11-15",
      "certificate_url": "строка",
      "file_url": "строка"
    }
  ]
}
```

### `POST /me/antidoping`

**Отметить антидопинговый курс РУСАДА**. Добавляет сертификат антидопингового курса РУСАДА.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `passed_on` | string | да |  |
| `certificate_url` | string или null | нет | длина ≤ 500; формат `^https?://` |
| `file_id` | string или null | нет |  |

```json
{
  "passed_on": "2026-11-15",
  "certificate_url": "строка",
  "file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Ответ `201`:

```json
{
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "sex": "male",
  "organization": {
    "id": 1,
    "name": "строка"
  },
  "no_organization": true,
  "start_year": 1,
  "training_stage": {
    "value": "initial",
    "title": "строка"
  },
  "disciplines": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "organization_history": [
    {
      "organization": "строка",
      "valid_from": "2026-11-15",
      "valid_to": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "status": "requested",
      "status_title": "строка",
      "created_at": "2026-11-15T12:00:00+05:00",
      "updated_at": "2026-11-15T12:00:00+05:00",
      "events": [
        {
          "status": "requested",
          "status_title": "строка",
          "actor": "строка",
          "comment": "строка",
          "created_at": "2026-11-15T12:00:00+05:00"
        }
      ]
    }
  ],
  "antidoping": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "passed_on": "2026-11-15",
      "valid_until": "2026-11-15",
      "certificate_url": "строка",
      "file_url": "строка"
    }
  ]
}
```

### `DELETE /me/antidoping/{certificate_id}`

**Удалить отметку**. Удаляет сертификат антидопингового курса.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `certificate_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "sex": "male",
  "organization": {
    "id": 1,
    "name": "строка"
  },
  "no_organization": true,
  "start_year": 1,
  "training_stage": {
    "value": "initial",
    "title": "строка"
  },
  "disciplines": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "organization_history": [
    {
      "organization": "строка",
      "valid_from": "2026-11-15",
      "valid_to": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "status": "requested",
      "status_title": "строка",
      "created_at": "2026-11-15T12:00:00+05:00",
      "updated_at": "2026-11-15T12:00:00+05:00",
      "events": [
        {
          "status": "requested",
          "status_title": "строка",
          "actor": "строка",
          "comment": "строка",
          "created_at": "2026-11-15T12:00:00+05:00"
        }
      ]
    }
  ],
  "antidoping": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "passed_on": "2026-11-15",
      "valid_until": "2026-11-15",
      "certificate_url": "строка",
      "file_url": "строка"
    }
  ]
}
```

### `GET /me/coach-links`

**Мои связи: как тренер и как спортсмен**. Возвращает связи текущего пользователя как тренера и как спортсмена.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/coach-links`:

```json
{
  "as_coach": [
    {
      "id": "f3f23b7a-7743-4172-b5c7-c4abc2138fdf",
      "coach": {
        "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
        "name": "Тренеров Игорь Николаевич",
        "birth_date": "1985-11-02"
      },
      "athlete": {
        "id": "2b1dcb17-d336-45ed-95e5-ca0fe8c9d7a9",
        "name": "Ковалёв Никита Сергеевич",
        "birth_date": "2010-02-14"
      },
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "status": "active",
      "status_title": "Активна",
      "created_at": "2026-09-28T14:21:27.848354Z",
      "updated_at": "2026-10-28T14:21:27.848354Z",
      "events": [
        {
          "status": "requested",
          "status_title": "Ждёт подтверждения",
          "actor": "Тренеров Игорь",
          "comment": null,
          "created_at": "2026-09-28T14:21:27.848354Z"
        },
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ],
  "as_athlete": []
}
```

### `GET /coach-links/candidates`

**Поиск спортсмена для привязки**. Ищет спортсменов для привязки к тренеру.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |

Ответ `200` — реальный ответ демо-стенда на `GET /coach-links/candidates`:

```json
[
  {
    "athlete": {
      "id": "432b7982-ec12-4beb-a5e0-bae0e020feb3",
      "name": "Андреева Екатерина Павловна",
      "birth_date": "2005-10-03"
    },
    "municipality": "г. Орск",
    "linked": false
  },
  "…ещё элементы"
]
```

### `POST /coach-links`

**Запросить привязку спортсмена**. Тренер отправляет спортсмену запрос на привязку.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `athlete_id` | string | да |  |
| `discipline_id` | integer | да | ≥ 1 |
| `comment` | string или null | нет | длина ≤ 500 |

```json
{
  "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "discipline_id": 1,
  "comment": "строка"
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "coach": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "status": "requested",
  "status_title": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00",
  "events": [
    {
      "status": "requested",
      "status_title": "строка",
      "actor": "строка",
      "comment": "строка",
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ]
}
```

### `GET /coach-links/{link_id}`

**Связь и её история**. Возвращает связь с историей.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `link_id` | путь | string | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /coach-links/f3f23b7a-7743-4172-b5c7-c4abc2138fdf`:

```json
{
  "id": "f3f23b7a-7743-4172-b5c7-c4abc2138fdf",
  "coach": {
    "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
    "name": "Тренеров Игорь Николаевич",
    "birth_date": "1985-11-02"
  },
  "athlete": {
    "id": "2b1dcb17-d336-45ed-95e5-ca0fe8c9d7a9",
    "name": "Ковалёв Никита Сергеевич",
    "birth_date": "2010-02-14"
  },
  "discipline": {
    "id": 1,
    "name": "Алгоритмическое программирование"
  },
  "status": "active",
  "status_title": "Активна",
  "created_at": "2026-09-28T14:21:27.848354Z",
  "updated_at": "2026-10-28T14:21:27.848354Z",
  "events": [
    {
      "status": "requested",
      "status_title": "Ждёт подтверждения",
      "actor": "Тренеров Игорь",
      "comment": null,
      "created_at": "2026-09-28T14:21:27.848354Z"
    },
    "…ещё элементы"
  ]
}
```

### `POST /coach-links/{link_id}/{action}`

**Принять, отклонить, приостановить, возобновить, завершить**. Меняет статус связи действием одной из сторон.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `link_id` | путь | string | да |  |  |
| `action` | путь | string | да |  | значения: `accept`, `decline`, `suspend`, `resume`, `end` |

Тело запроса:

```json
{
  "comment": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "coach": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "status": "requested",
  "status_title": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00",
  "events": [
    {
      "status": "requested",
      "status_title": "строка",
      "actor": "строка",
      "comment": "строка",
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ]
}
```

## Организации и реестр

### `GET /organizations`

**Поиск организаций**. Публичный поиск действующих организаций.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `municipality_id` | query | integer | нет |  |  |
| `organization_type_id` | query | integer | нет |  |  |
| `limit` | query | integer | нет | `30` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /organizations`:

```json
{
  "items": [
    {
      "id": 6,
      "name": "Клуб спортивного программирования «Байт»",
      "short_name": "Клуб «Байт»",
      "organization_type": {
        "id": 6,
        "name": "Спортивный клуб"
      },
      "municipality": {
        "id": 4,
        "name": "г. Бузулук"
      },
      "inn": "5603••••66",
      "address": null,
      "website": null,
      "license_number": null,
      "license_date": null,
      "is_active": true,
      "athletes": 3
    },
    "…ещё элементы"
  ],
  "total": 6
}
```

### `GET /admin/organizations`

**Организации: все, с архивом**. Поиск организаций для федерации, включая неактивные.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `municipality_id` | query | integer | нет |  |  |
| `organization_type_id` | query | integer | нет |  |  |
| `limit` | query | integer | нет | `20` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/organizations`:

```json
{
  "items": [
    {
      "id": 6,
      "name": "Клуб спортивного программирования «Байт»",
      "short_name": "Клуб «Байт»",
      "organization_type": {
        "id": 6,
        "name": "Спортивный клуб"
      },
      "municipality": {
        "id": 4,
        "name": "г. Бузулук"
      },
      "inn": "5603000066",
      "address": null,
      "website": null,
      "license_number": null,
      "license_date": null,
      "is_active": true,
      "athletes": 3
    },
    "…ещё элементы"
  ],
  "total": 6
}
```

### `POST /admin/organizations`

**Добавить организацию**. Создаёт организацию.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `name` | string или null | нет | длина ≥ 2; длина ≤ 300 |
| `short_name` | string или null | нет | длина ≤ 300 |
| `organization_type_id` | integer или null | нет | ≥ 1 |
| `municipality_id` | integer или null | нет | ≥ 1 |
| `inn` | string или null | нет | длина ≤ 12 |
| `address` | string или null | нет | длина ≤ 300 |
| `website` | string или null | нет | длина ≤ 300 |
| `license_number` | string или null | нет | длина ≤ 100 |
| `license_date` | string или null | нет |  |
| `is_active` | boolean или null | нет |  |

```json
{
  "name": "строка",
  "short_name": "строка",
  "organization_type_id": 1,
  "municipality_id": 1,
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true
}
```

Ответ `201`:

```json
{
  "id": 1,
  "name": "строка",
  "short_name": "строка",
  "organization_type": {
    "id": 1,
    "name": "строка"
  },
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true,
  "athletes": 0
}
```

### `PATCH /admin/organizations/{organization_id}`

**Изменить организацию**. Правит организацию.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `name` | string или null | нет | длина ≥ 2; длина ≤ 300 |
| `short_name` | string или null | нет | длина ≤ 300 |
| `organization_type_id` | integer или null | нет | ≥ 1 |
| `municipality_id` | integer или null | нет | ≥ 1 |
| `inn` | string или null | нет | длина ≤ 12 |
| `address` | string или null | нет | длина ≤ 300 |
| `website` | string или null | нет | длина ≤ 300 |
| `license_number` | string или null | нет | длина ≤ 100 |
| `license_date` | string или null | нет |  |
| `is_active` | boolean или null | нет |  |

```json
{
  "name": "строка",
  "short_name": "строка",
  "organization_type_id": 1,
  "municipality_id": 1,
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true
}
```

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "short_name": "строка",
  "organization_type": {
    "id": 1,
    "name": "строка"
  },
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true,
  "athletes": 0
}
```

### `GET /admin/registry/athletes`

**Реестр спортсменов**. Возвращает страницу реестра спортсменов.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |
| `q` | query | string | нет |  | длина ≤ 100 |
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `organization_id` | query | integer | нет |  | ≥ 1 |
| `no_organization` | query | boolean | нет | `False` |  |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `age_group_id` | query | integer | нет |  | ≥ 1 |
| `rank_type_id` | query | integer | нет |  | ≥ 1 |
| `without_rank` | query | boolean | нет | `False` |  |
| `training_stage` | query | string | нет |  | значения: `initial`, `training`, `improvement`, `highest` |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/registry/athletes`:

```json
{
  "items": [
    {
      "id": "432b7982-ec12-4beb-a5e0-bae0e020feb3",
      "name": "Андреева Екатерина Павловна",
      "birth_date": "2005-10-03",
      "age": 21,
      "age_group": "18 лет и старше",
      "municipality": "г. Орск",
      "organization": {
        "id": 3,
        "name": "ОГУ"
      },
      "no_organization": false,
      "disciplines": [
        "Алгоритмическое программирование"
      ],
      "start_year": 2021,
      "training_stage": "Высшее спортивное мастерство",
      "rank": null,
      "rank_valid_until": null,
      "coaches": []
    },
    "…ещё элементы"
  ],
  "total": 37
}
```

### `GET /admin/registry/athletes.xlsx`

**Реестр спортсменов, xlsx**. Выгружает реестр спортсменов в xlsx.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `organization_id` | query | integer | нет |  | ≥ 1 |
| `no_organization` | query | boolean | нет | `False` |  |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `age_group_id` | query | integer | нет |  | ≥ 1 |
| `rank_type_id` | query | integer | нет |  | ≥ 1 |
| `without_rank` | query | boolean | нет | `False` |  |
| `training_stage` | query | string | нет |  | значения: `initial`, `training`, `improvement`, `highest` |

Ответ `200`: файл или редирект.

### `GET /admin/registry/coaches`

**Реестр тренеров**. Возвращает страницу реестра тренеров.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/registry/coaches`:

```json
{
  "items": [
    {
      "id": "92b1ccce-9cec-4cca-83af-bcad1f7cdfa7",
      "name": "Зайцева Ольга Михайловна",
      "municipality": "г. Оренбург",
      "athletes": 0,
      "disciplines": []
    },
    "…ещё элементы"
  ],
  "total": 3
}
```

### `GET /admin/registry/coaches.xlsx`

**Реестр тренеров, xlsx**. Выгружает реестр тренеров в xlsx.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `discipline_id` | query | integer | нет |  | ≥ 1 |

Ответ `200`: файл или редирект.

### `GET /admin/registry/judges`

**Реестр судей**. Возвращает страницу реестра судей.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `state` | query | string | нет |  | значения: `valid`, `expiring`, `expired`, `none` |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/registry/judges`:

```json
{
  "items": [
    {
      "id": "92b1ccce-9cec-4cca-83af-bcad1f7cdfa7",
      "name": "Зайцева Ольга Михайловна",
      "municipality": "г. Оренбург",
      "category": "Спортивный судья первой категории",
      "valid_until": "2029-03-06",
      "state": "valid",
      "assignments": 16
    },
    "…ещё элементы"
  ],
  "total": 2
}
```

### `GET /admin/registry/judges.xlsx`

**Реестр судей, xlsx**. Выгружает реестр судей в xlsx.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `state` | query | string | нет |  | значения: `valid`, `expiring`, `expired`, `none` |

Ответ `200`: файл или редирект.

### `GET /admin/registry/headcount`

**Численность занимающихся по годам**. Возвращает численность занимающихся по годам в разрезе.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `cut` | query | string | нет | `total` | значения: `total`, `discipline`, `organization`, `age_group`, `municipality`, `stage` |
| `from` | query | integer | нет |  |  |
| `to` | query | integer | нет |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/registry/headcount`:

```json
{
  "years": [
    2024,
    "…ещё элементы"
  ],
  "dates": [
    "2024-12-31",
    "…ещё элементы"
  ],
  "cut": "total",
  "total": [
    29,
    "…ещё элементы"
  ],
  "in_groups": [
    3,
    "…ещё элементы"
  ],
  "rows": [],
  "sources": [
    "Спортивные профили: периоды дисциплин и организаций",
    "…ещё элементы"
  ]
}
```

### `GET /admin/registry/headcount.xlsx`

**Отчёт о численности, xlsx: все разрезы**. Выгружает отчёт о численности занимающихся во всех разрезах.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `from` | query | integer | нет |  |  |
| `to` | query | integer | нет |  |  |

Ответ `200`: файл или редирект.

## Спортивная подготовка: программы, группы, журнал, нормативы

### `GET /admin/organizations/{organization_id}`

**Карточка организации для федерации**. Карточка организации с полным ИНН, включая неактивные.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/organizations/1`:

```json
{
  "id": 1,
  "name": "МАОУ «Лицей № 1» г. Оренбурга",
  "short_name": "Лицей № 1",
  "organization_type": {
    "id": 2,
    "name": "Лицей / гимназия"
  },
  "municipality": {
    "id": 1,
    "name": "г. Оренбург"
  },
  "inn": "5610000011",
  "address": null,
  "website": null,
  "license_number": null,
  "license_date": null,
  "is_active": true,
  "programs": [
    {
      "id": 14,
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "stage": {
        "value": "initial",
        "title": "Начальная подготовка"
      },
      "valid_from": "2023-09-01"
    },
    "…ещё элементы"
  ],
  "coaches": [
    {
      "id": 1,
      "coach": {
        "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
        "name": "Тренеров Игорь Николаевич"
      },
      "position": "Тренер-преподаватель",
      "valid_from": "2024-08-19"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "НП-2 · алгоритмика",
      "organization": {
        "id": 1,
        "name": "Лицей № 1"
      },
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "stage": {
        "value": "initial",
        "title": "Начальная подготовка"
      },
      "coach": {
        "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
        "name": "Тренеров Игорь Николаевич"
      },
      "start_year": 2024,
      "is_active": true,
      "size": 2
    }
  ],
  "…": "ещё 1 полей"
}
```

### `GET /organizations/{organization_id}`

**Карточка организации: программы, тренеры, группы**. Публичная карточка действующей организации.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /organizations/1`:

```json
{
  "id": 1,
  "name": "МАОУ «Лицей № 1» г. Оренбурга",
  "short_name": "Лицей № 1",
  "organization_type": {
    "id": 2,
    "name": "Лицей / гимназия"
  },
  "municipality": {
    "id": 1,
    "name": "г. Оренбург"
  },
  "inn": "5610••••11",
  "address": null,
  "website": null,
  "license_number": null,
  "license_date": null,
  "is_active": true,
  "programs": [
    {
      "id": 14,
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "stage": {
        "value": "initial",
        "title": "Начальная подготовка"
      },
      "valid_from": "2023-09-01"
    },
    "…ещё элементы"
  ],
  "coaches": [
    {
      "id": 1,
      "coach": {
        "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
        "name": "Тренеров Игорь Николаевич"
      },
      "position": "Тренер-преподаватель",
      "valid_from": "2024-08-19"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "НП-2 · алгоритмика",
      "organization": {
        "id": 1,
        "name": "Лицей № 1"
      },
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "stage": {
        "value": "initial",
        "title": "Начальная подготовка"
      },
      "coach": {
        "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
        "name": "Тренеров Игорь Николаевич"
      },
      "start_year": 2024,
      "is_active": true,
      "size": 2
    }
  ],
  "…": "ещё 1 полей"
}
```

### `POST /admin/organizations/{organization_id}/programs`

**Добавить программу подготовки**. Добавляет программу спортивной подготовки по дисциплине и этапу.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `discipline_id` | integer | да | ≥ 1 |
| `stage` | string | да | значения: `initial`, `training`, `improvement`, `highest` |

```json
{
  "discipline_id": 1,
  "stage": "initial"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "name": "строка",
  "short_name": "строка",
  "organization_type": {
    "id": 1,
    "name": "строка"
  },
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true,
  "programs": [
    {
      "id": 1,
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "valid_from": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": 1,
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "position": "строка",
      "valid_from": "2026-11-15"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    }
  ],
  "…": "ещё 1 полей"
}
```

### `DELETE /admin/organizations/{organization_id}/programs/{program_id}`

**Закрыть программу подготовки**. Закрывает программу сегодняшним днём; история остаётся.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |
| `program_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "short_name": "строка",
  "organization_type": {
    "id": 1,
    "name": "строка"
  },
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true,
  "programs": [
    {
      "id": 1,
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "valid_from": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": 1,
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "position": "строка",
      "valid_from": "2026-11-15"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    }
  ],
  "…": "ещё 1 полей"
}
```

### `POST /admin/organizations/{organization_id}/coaches`

**Добавить тренера-преподавателя**. Добавляет тренера-преподавателя в организацию.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `coach_id` | string | да |  |
| `position` | string | нет | длина ≥ 2; длина ≤ 120 |

```json
{
  "coach_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "position": "Тренер-преподаватель"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "name": "строка",
  "short_name": "строка",
  "organization_type": {
    "id": 1,
    "name": "строка"
  },
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true,
  "programs": [
    {
      "id": 1,
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "valid_from": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": 1,
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "position": "строка",
      "valid_from": "2026-11-15"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    }
  ],
  "…": "ещё 1 полей"
}
```

### `DELETE /admin/organizations/{organization_id}/coaches/{record_id}`

**Завершить работу тренера**. Завершает работу тренера в организации сегодняшним днём.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | путь | integer | да |  |  |
| `record_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "short_name": "строка",
  "organization_type": {
    "id": 1,
    "name": "строка"
  },
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "inn": "строка",
  "address": "строка",
  "website": "строка",
  "license_number": "строка",
  "license_date": "2026-11-15",
  "is_active": true,
  "programs": [
    {
      "id": 1,
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "valid_from": "2026-11-15"
    }
  ],
  "coaches": [
    {
      "id": 1,
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "position": "строка",
      "valid_from": "2026-11-15"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    }
  ],
  "…": "ещё 1 полей"
}
```

### `GET /training/groups`

**Группы: федерация — все, тренер — свои**. Возвращает группы по фильтрам с числом занимающихся.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `organization_id` | query | integer | нет |  |  |
| `coach_id` | query | string | нет |  |  |
| `discipline_id` | query | integer | нет |  |  |
| `stage` | query | string | нет |  | значения: `initial`, `training`, `improvement`, `highest` |
| `active_only` | query | boolean | нет | `True` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /training/groups`:

```json
[
  {
    "id": 1,
    "name": "НП-2 · алгоритмика",
    "organization": {
      "id": 1,
      "name": "Лицей № 1"
    },
    "discipline": {
      "id": 1,
      "name": "Алгоритмическое программирование"
    },
    "stage": {
      "value": "initial",
      "title": "Начальная подготовка"
    },
    "coach": {
      "id": "9b9dca2e-7f5c-4015-9d14-aaebf2dc2fb4",
      "name": "Тренеров Игорь Николаевич"
    },
    "start_year": 2024,
    "is_active": true,
    "size": 2
  },
  "…ещё элементы"
]
```

### `POST /training/groups`

**Создать группу**. Создаёт группу по действующей программе организации.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `organization_id` | integer или null | нет | ≥ 1 |
| `discipline_id` | integer или null | нет | ≥ 1 |
| `stage` | string или null | нет | значения: `initial`, `training`, `improvement`, `highest` |
| `coach_id` | string или null | нет |  |
| `name` | string или null | нет | длина ≥ 2; длина ≤ 120 |
| `start_year` | integer или null | нет |  |
| `is_active` | boolean или null | нет |  |

```json
{
  "organization_id": 1,
  "discipline_id": 1,
  "stage": "initial",
  "coach_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "строка",
  "start_year": 1,
  "is_active": true
}
```

Ответ `201`:

```json
{
  "id": 1,
  "name": "строка",
  "organization": {
    "id": 1,
    "name": "строка"
  },
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "stage": {
    "value": "initial",
    "title": "строка"
  },
  "coach": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "start_year": 1,
  "is_active": true,
  "size": 0
}
```

### `GET /training/groups/{group_id}`

**Группа: состав и история зачислений**. Возвращает группу, текущий состав и прошлые зачисления.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `group_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "current": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "group": {
        "id": 1,
        "name": "строка",
        "organization": {
          "id": 1,
          "name": "строка"
        },
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "coach": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "строка"
        },
        "start_year": 1,
        "is_active": true,
        "size": 0
      },
      "valid_from": "2026-11-15",
      "valid_to": "2026-11-15",
      "end_reason": "transferred",
      "end_reason_title": "строка",
      "order_number": "строка",
      "note": "строка",
      "previous_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
  ],
  "history": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "group": {
        "id": 1,
        "name": "строка",
        "organization": {
          "id": 1,
          "name": "строка"
        },
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "coach": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "строка"
        },
        "start_year": 1,
        "is_active": true,
        "size": 0
      },
      "valid_from": "2026-11-15",
      "valid_to": "2026-11-15",
      "end_reason": "transferred",
      "end_reason_title": "строка",
      "order_number": "строка",
      "note": "строка",
      "previous_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
  ]
}
```

### `PATCH /training/groups/{group_id}`

**Изменить группу**. Меняет название, тренера или закрывает группу.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `group_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `organization_id` | integer или null | нет | ≥ 1 |
| `discipline_id` | integer или null | нет | ≥ 1 |
| `stage` | string или null | нет | значения: `initial`, `training`, `improvement`, `highest` |
| `coach_id` | string или null | нет |  |
| `name` | string или null | нет | длина ≥ 2; длина ≤ 120 |
| `start_year` | integer или null | нет |  |
| `is_active` | boolean или null | нет |  |

```json
{
  "organization_id": 1,
  "discipline_id": 1,
  "stage": "initial",
  "coach_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "строка",
  "start_year": 1,
  "is_active": true
}
```

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "organization": {
    "id": 1,
    "name": "строка"
  },
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "stage": {
    "value": "initial",
    "title": "строка"
  },
  "coach": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "start_year": 1,
  "is_active": true,
  "size": 0
}
```

### `POST /training/groups/{group_id}/enrollments`

**Зачислить спортсмена**. Зачисляет спортсмена в группу с даты приказа.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `group_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `on` | string | да |  |
| `order_number` | string или null | нет | длина ≤ 50 |
| `note` | string или null | нет | длина ≤ 1000 |
| `athlete_id` | string | да |  |

```json
{
  "on": "2026-11-15",
  "order_number": "строка",
  "note": "строка",
  "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "valid_from": "2026-11-15",
  "valid_to": "2026-11-15",
  "end_reason": "transferred",
  "end_reason_title": "строка",
  "order_number": "строка",
  "note": "строка",
  "previous_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

### `POST /training/enrollments/{enrollment_id}/transfer`

**Перевести в другую группу**. Переводит спортсмена в другую группу той же дисциплины.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `enrollment_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `on` | string | да |  |
| `order_number` | string или null | нет | длина ≤ 50 |
| `note` | string или null | нет | длина ≤ 1000 |
| `target_group_id` | integer | да | ≥ 1 |

```json
{
  "on": "2026-11-15",
  "order_number": "строка",
  "note": "строка",
  "target_group_id": 1
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "valid_from": "2026-11-15",
  "valid_to": "2026-11-15",
  "end_reason": "transferred",
  "end_reason_title": "строка",
  "order_number": "строка",
  "note": "строка",
  "previous_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

### `POST /training/enrollments/{enrollment_id}/expel`

**Отчислить из группы**. Отчисляет спортсмена из группы с даты приказа.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `enrollment_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `on` | string | да |  |
| `order_number` | string или null | нет | длина ≤ 50 |
| `note` | string или null | нет | длина ≤ 1000 |

```json
{
  "on": "2026-11-15",
  "order_number": "строка",
  "note": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "valid_from": "2026-11-15",
  "valid_to": "2026-11-15",
  "end_reason": "transferred",
  "end_reason_title": "строка",
  "order_number": "строка",
  "note": "строка",
  "previous_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

### `GET /training/athletes/{athlete_id}/enrollments`

**История зачислений спортсмена**. История групп спортсмена: ему самому, его тренеру и федерации.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `athlete_id` | путь | string | да |  |  |

Ответ `200`:

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "athlete": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "group": {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    },
    "valid_from": "2026-11-15",
    "valid_to": "2026-11-15",
    "end_reason": "transferred",
    "end_reason_title": "строка",
    "order_number": "строка",
    "note": "строка",
    "previous_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
]
```

### `GET /training/groups/{group_id}/sessions`

**Журнал занятий группы**. Возвращает занятия группы за период, новые первыми.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `group_id` | путь | integer | да |  |  |
| `from` | query | string | нет |  |  |
| `to` | query | string | нет |  |  |

Ответ `200`:

```json
{
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "sessions": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "group_id": 1,
      "held_on": "2026-11-15",
      "topic": "строка",
      "format": "offline",
      "format_title": "строка",
      "proof_url": "строка",
      "proof_file": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "note": "строка",
      "present": 1,
      "marks": [
        {
          "athlete": {
            "id": "…",
            "name": "…"
          },
          "present": true
        }
      ],
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ]
}
```

### `POST /training/groups/{group_id}/sessions`

**Записать занятие**. Записывает занятие с форматом, подтверждением и отметками посещения.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `group_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `held_on` | string | да |  |
| `topic` | string | да | длина ≥ 1; длина ≤ 300 |
| `format` | string | да | значения: `offline`, `online` |
| `proof_url` | string или null | нет | длина ≤ 500; формат `^https?://` |
| `proof_file_id` | string или null | нет |  |
| `note` | string или null | нет | длина ≤ 1000 |
| `attendance` | array | нет | элементов ≤ 200 |

```json
{
  "held_on": "2026-11-15",
  "topic": "строка",
  "format": "offline",
  "proof_url": "строка",
  "proof_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "note": "строка",
  "attendance": [
    {
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "present": true
    }
  ]
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "group_id": 1,
  "held_on": "2026-11-15",
  "topic": "строка",
  "format": "offline",
  "format_title": "строка",
  "proof_url": "строка",
  "proof_file": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "note": "строка",
  "present": 1,
  "marks": [
    {
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "present": true
    }
  ],
  "created_at": "2026-11-15T12:00:00+05:00"
}
```

### `PUT /training/sessions/{session_id}`

**Изменить занятие**. Правит занятие и заменяет отметки посещения.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `session_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `held_on` | string | да |  |
| `topic` | string | да | длина ≥ 1; длина ≤ 300 |
| `format` | string | да | значения: `offline`, `online` |
| `proof_url` | string или null | нет | длина ≤ 500; формат `^https?://` |
| `proof_file_id` | string или null | нет |  |
| `note` | string или null | нет | длина ≤ 1000 |
| `attendance` | array | нет | элементов ≤ 200 |

```json
{
  "held_on": "2026-11-15",
  "topic": "строка",
  "format": "offline",
  "proof_url": "строка",
  "proof_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "note": "строка",
  "attendance": [
    {
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "present": true
    }
  ]
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "group_id": 1,
  "held_on": "2026-11-15",
  "topic": "строка",
  "format": "offline",
  "format_title": "строка",
  "proof_url": "строка",
  "proof_file": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "note": "строка",
  "present": 1,
  "marks": [
    {
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "present": true
    }
  ],
  "created_at": "2026-11-15T12:00:00+05:00"
}
```

### `DELETE /training/sessions/{session_id}`

**Удалить занятие**. Удаляет занятие из журнала.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `session_id` | путь | string | да |  |  |

Ответ `204` — без тела.

### `GET /training/athletes/{athlete_id}/attendance`

**Посещаемость спортсмена**. Занятия групп спортсмена за период и сколько он посетил: ему, тренеру и федерации.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `athlete_id` | путь | string | да |  |  |
| `days` | query | integer | нет | `90` | ≥ 7, ≤ 730 |

Ответ `200`:

```json
{
  "total": 1,
  "attended": 1,
  "sessions": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "group_id": 1,
      "held_on": "2026-11-15",
      "topic": "строка",
      "format": "offline",
      "format_title": "строка",
      "proof_url": "строка",
      "proof_file": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "note": "строка",
      "present": 1,
      "marks": [
        {
          "athlete": {
            "id": "…",
            "name": "…"
          },
          "present": true
        }
      ],
      "created_at": "2026-11-15T12:00:00+05:00"
    }
  ],
  "groups": [
    {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    }
  ]
}
```

### `GET /norms`

**Справочник нормативов ОФП и СФП**. Публичный справочник действующих нормативов по этапам.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `stage` | query | string | нет |  | значения: `initial`, `training`, `improvement`, `highest` |

Ответ `200` — реальный ответ демо-стенда на `GET /norms`:

```json
[
  {
    "id": 1,
    "stage": {
      "value": "initial",
      "title": "Начальная подготовка"
    },
    "kind": "ofp",
    "kind_title": "Общая физическая подготовка",
    "name": "Бег на 30 м",
    "unit": "seconds",
    "unit_title": "с",
    "direction": "lower",
    "direction_title": "не более",
    "threshold_male": "6.30",
    "threshold_female": "6.50",
    "disciplines": [
      {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "…ещё элементы"
    ],
    "source": "Приказ Минспорта России от 24.06.2025 № 445, приложение № 6",
    "is_demo": false,
    "…": "ещё 2 полей"
  },
  "…ещё элементы"
]
```

### `GET /admin/norms`

**Нормативы с архивом**. Справочник нормативов для федерации, включая архивные.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `stage` | query | string | нет |  | значения: `initial`, `training`, `improvement`, `highest` |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/norms`:

```json
[
  {
    "id": 1,
    "stage": {
      "value": "initial",
      "title": "Начальная подготовка"
    },
    "kind": "ofp",
    "kind_title": "Общая физическая подготовка",
    "name": "Бег на 30 м",
    "unit": "seconds",
    "unit_title": "с",
    "direction": "lower",
    "direction_title": "не более",
    "threshold_male": "6.30",
    "threshold_female": "6.50",
    "disciplines": [
      {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "…ещё элементы"
    ],
    "source": "Приказ Минспорта России от 24.06.2025 № 445, приложение № 6",
    "is_demo": false,
    "…": "ещё 2 полей"
  },
  "…ещё элементы"
]
```

### `POST /admin/norms`

**Добавить норматив**. Добавляет норматив в справочник.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `stage` | string или null | нет | значения: `initial`, `training`, `improvement`, `highest` |
| `kind` | string или null | нет | значения: `ofp`, `sfp` |
| `name` | string или null | нет | длина ≤ 300 |
| `unit` | string или null | нет | значения: `seconds`, `min_sec`, `centimeters`, `times`, `chars` |
| `direction` | string или null | нет | значения: `higher`, `lower` |
| `threshold_male` | number или string или null | нет |  |
| `threshold_female` | number или string или null | нет |  |
| `discipline_ids` | array или null | нет | элементов ≤ 20 |
| `source` | string или null | нет | длина ≤ 300 |
| `is_demo` | boolean или null | нет |  |
| `sort_order` | integer или null | нет | ≥ 0; ≤ 1000 |
| `is_archived` | boolean или null | нет |  |

```json
{
  "stage": "initial",
  "kind": "ofp",
  "name": "строка",
  "unit": "seconds",
  "direction": "higher",
  "threshold_male": 1.0,
  "threshold_female": 1.0,
  "discipline_ids": [
    1
  ],
  "source": "строка",
  "is_demo": true,
  "sort_order": 1,
  "is_archived": true
}
```

Ответ `201`:

```json
{
  "id": 1,
  "stage": {
    "value": "initial",
    "title": "строка"
  },
  "kind": "ofp",
  "kind_title": "строка",
  "name": "строка",
  "unit": "seconds",
  "unit_title": "строка",
  "direction": "higher",
  "direction_title": "строка",
  "threshold_male": "строка",
  "threshold_female": "строка",
  "disciplines": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "source": "строка",
  "is_demo": true,
  "…": "ещё 2 полей"
}
```

### `PATCH /admin/norms/{norm_id}`

**Изменить норматив**. Правит норматив или отправляет его в архив.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `norm_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `stage` | string или null | нет | значения: `initial`, `training`, `improvement`, `highest` |
| `kind` | string или null | нет | значения: `ofp`, `sfp` |
| `name` | string или null | нет | длина ≤ 300 |
| `unit` | string или null | нет | значения: `seconds`, `min_sec`, `centimeters`, `times`, `chars` |
| `direction` | string или null | нет | значения: `higher`, `lower` |
| `threshold_male` | number или string или null | нет |  |
| `threshold_female` | number или string или null | нет |  |
| `discipline_ids` | array или null | нет | элементов ≤ 20 |
| `source` | string или null | нет | длина ≤ 300 |
| `is_demo` | boolean или null | нет |  |
| `sort_order` | integer или null | нет | ≥ 0; ≤ 1000 |
| `is_archived` | boolean или null | нет |  |

```json
{
  "stage": "initial",
  "kind": "ofp",
  "name": "строка",
  "unit": "seconds",
  "direction": "higher",
  "threshold_male": 1.0,
  "threshold_female": 1.0,
  "discipline_ids": [
    1
  ],
  "source": "строка",
  "is_demo": true,
  "sort_order": 1,
  "is_archived": true
}
```

Ответ `200`:

```json
{
  "id": 1,
  "stage": {
    "value": "initial",
    "title": "строка"
  },
  "kind": "ofp",
  "kind_title": "строка",
  "name": "строка",
  "unit": "seconds",
  "unit_title": "строка",
  "direction": "higher",
  "direction_title": "строка",
  "threshold_male": "строка",
  "threshold_female": "строка",
  "disciplines": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "source": "строка",
  "is_demo": true,
  "…": "ещё 2 полей"
}
```

### `POST /training/norm-results`

**Внести результаты сдачи**. Принимает результаты; платформа сама отмечает, выполнен ли норматив.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `items` | array | да | элементов ≤ 500 |

```json
{
  "items": [
    {
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "norm_id": 1,
      "value": 1.0,
      "passed_on": "2026-11-15"
    }
  ]
}
```

Ответ `201`:

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "norm": {
      "id": 1,
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "kind": "ofp",
      "kind_title": "строка",
      "name": "строка",
      "unit": "seconds",
      "unit_title": "строка",
      "direction": "higher",
      "direction_title": "строка",
      "threshold_male": "строка",
      "threshold_female": "строка",
      "disciplines": [
        {
          "id": 1,
          "name": "строка"
        }
      ],
      "source": "строка",
      "is_demo": true,
      "…": "ещё 2 полей"
    },
    "value": "строка",
    "threshold": "строка",
    "passed": true,
    "passed_on": "2026-11-15",
    "recorded_by": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    }
  }
]
```

### `GET /training/athletes/{athlete_id}/norms`

**История нормативов и аттестаций спортсмена**. История сдачи нормативов и аттестаций: спортсмену, его тренеру и федерации.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `athlete_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "athlete": "строка",
  "results": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "norm": {
        "id": 1,
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "kind": "ofp",
        "kind_title": "строка",
        "name": "строка",
        "unit": "seconds",
        "unit_title": "строка",
        "direction": "higher",
        "direction_title": "строка",
        "threshold_male": "строка",
        "threshold_female": "строка",
        "disciplines": [
          {
            "id": "…",
            "name": "…"
          }
        ],
        "source": "строка",
        "is_demo": true,
        "…": "ещё 2 полей"
      },
      "value": "строка",
      "threshold": "строка",
      "passed": true,
      "passed_on": "2026-11-15",
      "recorded_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      }
    }
  ],
  "attestations": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "group": {
        "id": 1,
        "name": "строка",
        "organization": {
          "id": 1,
          "name": "строка"
        },
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "coach": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "строка"
        },
        "start_year": 1,
        "is_active": true,
        "size": 0
      },
      "target_group": {
        "id": 1,
        "name": "строка",
        "organization": {
          "id": 1,
          "name": "строка"
        },
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "coach": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "строка"
        },
        "start_year": 1,
        "is_active": true,
        "size": 0
      },
      "stage_from": {
        "value": "initial",
        "title": "строка"
      },
      "stage_to": {
        "value": "initial",
        "title": "строка"
      },
      "result": "transferred",
      "result_title": "строка",
      "decided_on": "2026-11-15",
      "order_number": "строка",
      "comment": "строка",
      "is_override": true,
      "actor": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      }
    }
  ]
}
```

### `GET /training/groups/{group_id}/attestation`

**Аттестационная ведомость группы**. Кто из группы выполнил нормативы следующего этапа и в какие группы его можно перевести.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `group_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "target_stage": {
    "value": "initial",
    "title": "строка"
  },
  "rows": [
    {
      "enrollment_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "since": "2026-11-15",
      "ready": true,
      "passed": 1,
      "required": 1,
      "norms": [
        {
          "norm": {
            "id": "…",
            "stage": "…",
            "kind": "…",
            "kind_title": "…",
            "name": "…",
            "unit": "…",
            "unit_title": "…",
            "direction": "…",
            "direction_title": "…",
            "threshold_male": "…",
            "threshold_female": "…",
            "disciplines": "…",
            "source": "…",
            "is_demo": "…",
            "…": "ещё 2 полей"
          },
          "threshold": "строка",
          "state": "строка",
          "best": "строка",
          "best_on": "2026-11-15"
        }
      ]
    }
  ],
  "targets": [
    {
      "id": 1,
      "name": "строка",
      "organization": {
        "id": 1,
        "name": "строка"
      },
      "discipline": {
        "id": 1,
        "name": "строка"
      },
      "stage": {
        "value": "initial",
        "title": "строка"
      },
      "coach": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "start_year": 1,
      "is_active": true,
      "size": 0
    }
  ],
  "history": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      },
      "group": {
        "id": 1,
        "name": "строка",
        "organization": {
          "id": 1,
          "name": "строка"
        },
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "coach": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "строка"
        },
        "start_year": 1,
        "is_active": true,
        "size": 0
      },
      "target_group": {
        "id": 1,
        "name": "строка",
        "organization": {
          "id": 1,
          "name": "строка"
        },
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "stage": {
          "value": "initial",
          "title": "строка"
        },
        "coach": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "name": "строка"
        },
        "start_year": 1,
        "is_active": true,
        "size": 0
      },
      "stage_from": {
        "value": "initial",
        "title": "строка"
      },
      "stage_to": {
        "value": "initial",
        "title": "строка"
      },
      "result": "transferred",
      "result_title": "строка",
      "decided_on": "2026-11-15",
      "order_number": "строка",
      "comment": "строка",
      "is_override": true,
      "actor": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка"
      }
    }
  ]
}
```

### `POST /training/attestations`

**Оформить итог аттестации**. Фиксирует итог аттестации; при переводе зачисляет в группу следующего этапа.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `athlete_id` | string | да |  |
| `group_id` | integer | да | ≥ 1 |
| `result` | string | да | значения: `transferred`, `retained` |
| `target_group_id` | integer или null | нет | ≥ 1 |
| `on` | string | да |  |
| `order_number` | string или null | нет | длина ≤ 50 |
| `comment` | string или null | нет | длина ≤ 1000 |

```json
{
  "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "group_id": 1,
  "result": "transferred",
  "target_group_id": 1,
  "on": "2026-11-15",
  "order_number": "строка",
  "comment": "строка"
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "target_group": {
    "id": 1,
    "name": "строка",
    "organization": {
      "id": 1,
      "name": "строка"
    },
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "stage": {
      "value": "initial",
      "title": "строка"
    },
    "coach": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка"
    },
    "start_year": 1,
    "is_active": true,
    "size": 0
  },
  "stage_from": {
    "value": "initial",
    "title": "строка"
  },
  "stage_to": {
    "value": "initial",
    "title": "строка"
  },
  "result": "transferred",
  "result_title": "строка",
  "decided_on": "2026-11-15",
  "order_number": "строка",
  "comment": "строка",
  "is_override": true,
  "actor": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  }
}
```

## Справочники

### `GET /dictionaries`

**Список справочников**. Список всех справочников с их ключами и названиями.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries`:

```json
[
  {
    "key": "disciplines",
    "title": "Дисциплины"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/disciplines`

**Дисциплины**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/disciplines`:

```json
[
  {
    "id": 1,
    "name": "Алгоритмическое программирование",
    "description": "Решение алгоритмических задач на время, индивидуально и в командах",
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/municipalities`

**Муниципалитеты**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/municipalities`:

```json
[
  {
    "id": 1,
    "name": "г. Оренбург",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/organization_types`

**Типы организаций**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/organization_types`:

```json
[
  {
    "id": 1,
    "name": "Общеобразовательная школа",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/academic_groups`

**Академические группы**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/academic_groups`:

```json
[
  {
    "id": 1,
    "name": "1–4 классы",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/age_groups`

**Возрастные группы**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/age_groups`:

```json
[
  {
    "id": 1,
    "name": "До 14 лет",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z",
    "min_age": null,
    "max_age": 13
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/contest_types`

**Типы соревнований**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/contest_types`:

```json
[
  {
    "id": 1,
    "name": "Чемпионат",
    "description": "Без ограничения по возрасту",
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/contest_levels`

**Уровни соревнований**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/contest_levels`:

```json
[
  {
    "id": 1,
    "name": "Региональное",
    "description": "Чемпионаты и первенства области и иные региональные",
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/contest_formats`

**Форматы проведения**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/contest_formats`:

```json
[
  {
    "id": 1,
    "name": "Очно",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/rank_types`

**Разряды и звания**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/rank_types`:

```json
[
  {
    "id": 1,
    "name": "Заслуженный мастер спорта России",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z",
    "rank_kind": "Спортивное звание",
    "min_age": null,
    "validity_months": null,
    "is_lifetime": true,
    "valid_until_age": null
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/judge_categories`

**Судейские категории**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/judge_categories`:

```json
[
  {
    "id": 1,
    "name": "Спортивный судья всероссийской категории",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z",
    "validity_months": 48
  },
  "…ещё элементы"
]
```

### `GET /dictionaries/judge_positions`

**Судейские должности**. Список активных записей справочника.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /dictionaries/judge_positions`:

```json
[
  {
    "id": 1,
    "name": "Главный судья",
    "description": null,
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

## Справочники: управление федерацией

Одинаковый набор эндпоинтов у каждого из 11 справочников: `disciplines`, `municipalities`, `organization_types`, `academic_groups`, `age_groups`, `contest_types`, `contest_levels`, `contest_formats`, `rank_types`, `judge_categories`, `judge_positions`. Ниже — на примере дисциплин: замените `disciplines` на ключ нужного справочника. Удалить можно только неиспользуемую запись (иначе 409 `in_use`), используемую — архивировать.

### `GET /admin/dictionaries/disciplines`

**List Disciplines**. Список записей справочника.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `include_archived` | query | boolean | нет | `False` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/dictionaries/disciplines`:

```json
[
  {
    "id": 1,
    "name": "Алгоритмическое программирование",
    "description": "Решение алгоритмических задач на время, индивидуально и в командах",
    "is_archived": false,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `POST /admin/dictionaries/disciplines`

**Create Disciplines**. Создаёт запись справочника.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `name` | string | да | длина ≥ 1; длина ≤ 200 |
| `description` | string или null | нет | длина ≤ 2000 |

```json
{
  "name": "строка",
  "description": "строка"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "name": "строка",
  "description": "строка",
  "is_archived": true,
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `DELETE /admin/dictionaries/disciplines/{item_id}`

**Delete Disciplines**. Удаляет запись справочника.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `item_id` | путь | integer | да |  |  |

Ответ `204` — без тела.

### `PATCH /admin/dictionaries/disciplines/{item_id}`

**Update Disciplines**. Обновляет запись справочника.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `item_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `name` | string или null | нет | длина ≥ 1; длина ≤ 200 |
| `description` | string или null | нет | длина ≤ 2000 |

```json
{
  "name": "строка",
  "description": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "description": "строка",
  "is_archived": true,
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `POST /admin/dictionaries/disciplines/{item_id}/archive`

**Archive Disciplines**. Архивирует запись справочника.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `item_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "description": "строка",
  "is_archived": true,
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `POST /admin/dictionaries/disciplines/{item_id}/restore`

**Restore Disciplines**. Восстанавливает запись справочника из архива.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `item_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "name": "строка",
  "description": "строка",
  "is_archived": true,
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

## Соревнования

### `GET /contests`

**Календарь соревнований**. Возвращает страницу опубликованных соревнований для календаря.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |
| `discipline_id` | query | integer | нет |  |  |
| `contest_level_id` | query | integer | нет |  |  |
| `contest_format_id` | query | integer | нет |  |  |
| `participation_type` | query | string | нет |  | значения: `individual`, `team` |
| `age_group_id` | query | integer | нет |  |  |
| `academic_group_id` | query | integer | нет |  |  |
| `municipality_id` | query | integer | нет |  |  |
| `status` | query | string | нет |  | значения: `draft`, `published`, `registration_open`, `registration_closed`, `in_progress`, `completed`, `archived`, `cancelled` |
| `verified_only` | query | boolean | нет | `False` |  |
| `has_prize_fund` | query | boolean | нет | `False` |  |
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `search` | query | string | нет |  | длина ≤ 200 |
| `sort` | query | string | нет |  |  |
| `period` | query | string | нет | `upcoming` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests`:

```json
{
  "items": [
    {
      "id": 15,
      "title": "Командный CTF «Оренбургский рубеж»",
      "description": null,
      "discipline": {
        "id": 3,
        "name": "Программирование систем информационной безопасности"
      },
      "contest_type": {
        "id": 4,
        "name": "Турнир"
      },
      "contest_level": {
        "id": 1,
        "name": "Региональное"
      },
      "contest_format": {
        "id": 1,
        "name": "Очно"
      },
      "participation_type": "team",
      "team_size_min": 2,
      "team_size_max": 3,
      "municipality": {
        "id": 1,
        "name": "г. Оренбург"
      },
      "venue": null,
      "age_groups": [
        {
          "id": 2,
          "name": "14–17 лет"
        }
      ],
      "academic_groups": [],
      "…": "ещё 19 полей"
    },
    "…ещё элементы"
  ],
  "total": 6
}
```

### `GET /contests/{contest_id}`

**Карточка соревнования**. Возвращает карточку опубликованного соревнования по id.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7`:

```json
{
  "id": 7,
  "title": "Чемпионат Оренбургской области по алгоритмическому программированию",
  "description": "Личный чемпионат области.",
  "discipline": {
    "id": 1,
    "name": "Алгоритмическое программирование"
  },
  "contest_type": {
    "id": 1,
    "name": "Чемпионат"
  },
  "contest_level": {
    "id": 1,
    "name": "Региональное"
  },
  "contest_format": {
    "id": 1,
    "name": "Очно"
  },
  "participation_type": "individual",
  "team_size_min": null,
  "team_size_max": null,
  "municipality": {
    "id": 1,
    "name": "г. Оренбург"
  },
  "venue": "ОГУ, корпус 2",
  "age_groups": [],
  "academic_groups": [],
  "…": "ещё 19 полей"
}
```

### `GET /organizer/contests`

**Мои соревнования**. Возвращает страницу соревнований текущего организатора по фильтру.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `status` | query | string | нет |  | значения: `draft`, `published`, `registration_open`, `registration_closed`, `in_progress`, `completed`, `archived`, `cancelled` |
| `verification_status` | query | string | нет |  | значения: `not_requested`, `pending`, `verified`, `rejected` |
| `search` | query | string | нет |  | длина ≤ 200 |
| `sort` | query | string | нет |  |  |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /organizer/contests`:

```json
{
  "items": [
    {
      "id": 5,
      "title": "Турнир по робототехнике",
      "description": null,
      "discipline": {
        "id": 5,
        "name": "Программирование робототехники"
      },
      "contest_type": {
        "id": 4,
        "name": "Турнир"
      },
      "contest_level": {
        "id": 1,
        "name": "Региональное"
      },
      "contest_format": {
        "id": 1,
        "name": "Очно"
      },
      "participation_type": "team",
      "team_size_min": 2,
      "team_size_max": 2,
      "municipality": {
        "id": 3,
        "name": "г. Новотроицк"
      },
      "venue": null,
      "age_groups": [],
      "academic_groups": [],
      "…": "ещё 26 полей"
    },
    "…ещё элементы"
  ],
  "total": 26
}
```

### `POST /organizer/contests`

**Создать соревнование**. Создаёт соревнование от имени текущего организатора.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 1; длина ≤ 300 |
| `description` | string или null | нет | длина ≤ 10000 |
| `discipline_id` | integer | да | ≥ 1 |
| `contest_type_id` | integer | да | ≥ 1 |
| `contest_level_id` | integer | да | ≥ 1 |
| `contest_format_id` | integer | да | ≥ 1 |
| `participation_type` | string | да | значения: `individual`, `team` |
| `team_size_min` | integer или null | нет | ≥ 1; ≤ 100 |
| `team_size_max` | integer или null | нет | ≥ 1; ≤ 100 |
| `municipality_id` | integer или null | нет | ≥ 1 |
| `venue` | string или null | нет | длина ≤ 500 |
| `age_group_ids` | array | нет | элементов ≤ 20 |
| `academic_group_ids` | array | нет | элементов ≤ 20 |
| `starts_on` | string | да |  |
| `ends_on` | string | да |  |
| `registration_opens_at` | string | да |  |
| `registration_closes_at` | string | да |  |
| `prize_fund_text` | string или null | нет | длина ≤ 500 |
| `prize_fund_amount` | integer или null | нет | ≥ 0 |
| `calendar_plan` | string | нет | значения: `none`, `ekp`, `regional` |
| `calendar_plan_number` | string или null | нет | длина ≤ 50 |
| `regulations_file_id` | string или null | нет |  |
| `photo_file_ids` | array | нет |  |

```json
{
  "title": "строка",
  "description": "строка",
  "discipline_id": 1,
  "contest_type_id": 1,
  "contest_level_id": 1,
  "contest_format_id": 1,
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality_id": 1,
  "venue": "строка",
  "age_group_ids": [
    1
  ],
  "academic_group_ids": [
    1
  ],
  "starts_on": "2026-11-15",
  "…": "ещё 9 полей"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `GET /organizer/contests/{contest_id}`

**Моё соревнование**. Возвращает соревнование организатора по id.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `PATCH /organizer/contests/{contest_id}`

**Изменить соревнование**. Обновляет указанные поля своего соревнования.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string или null | нет | длина ≥ 1; длина ≤ 300 |
| `description` | string или null | нет | длина ≤ 10000 |
| `discipline_id` | integer или null | нет | ≥ 1 |
| `contest_type_id` | integer или null | нет | ≥ 1 |
| `contest_level_id` | integer или null | нет | ≥ 1 |
| `contest_format_id` | integer или null | нет | ≥ 1 |
| `participation_type` | string или null | нет | значения: `individual`, `team` |
| `team_size_min` | integer или null | нет | ≥ 1; ≤ 100 |
| `team_size_max` | integer или null | нет | ≥ 1; ≤ 100 |
| `municipality_id` | integer или null | нет | ≥ 1 |
| `venue` | string или null | нет | длина ≤ 500 |
| `age_group_ids` | array или null | нет | элементов ≤ 20 |
| `academic_group_ids` | array или null | нет | элементов ≤ 20 |
| `starts_on` | string или null | нет |  |
| `ends_on` | string или null | нет |  |
| `registration_opens_at` | string или null | нет |  |
| `registration_closes_at` | string или null | нет |  |
| `prize_fund_text` | string или null | нет | длина ≤ 500 |
| `prize_fund_amount` | integer или null | нет | ≥ 0 |
| `calendar_plan` | string или null | нет | значения: `none`, `ekp`, `regional` |
| `calendar_plan_number` | string или null | нет | длина ≤ 50 |
| `regulations_file_id` | string или null | нет |  |
| `photo_file_ids` | array или null | нет |  |

```json
{
  "title": "строка",
  "description": "строка",
  "discipline_id": 1,
  "contest_type_id": 1,
  "contest_level_id": 1,
  "contest_format_id": 1,
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality_id": 1,
  "venue": "строка",
  "age_group_ids": [
    1
  ],
  "academic_group_ids": [
    1
  ],
  "starts_on": "2026-11-15",
  "…": "ещё 9 полей"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `DELETE /organizer/contests/{contest_id}`

**Удалить соревнование**. Удаляет своё соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `204` — без тела.

### `POST /organizer/contests/{contest_id}/cancel`

**Отменить**. Отменяет своё соревнование с указанием причины.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/request-verification`

**Запросить верификацию**. Отправляет своё соревнование на верификацию в федерацию.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/publish`

**Опубликовать**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/unpublish`

**Снять с публикации**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/open-registration`

**Открыть регистрацию**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/close-registration`

**Закрыть регистрацию**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/start`

**Начать**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/complete`

**Завершить**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /organizer/contests/{contest_id}/archive`

**В архив**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `GET /admin/contests`

**Все соревнования**. Возвращает страницу всех соревнований для федерации по фильтру.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |
| `status` | query | string | нет |  | значения: `draft`, `published`, `registration_open`, `registration_closed`, `in_progress`, `completed`, `archived`, `cancelled` |
| `verification_status` | query | string | нет |  | значения: `not_requested`, `pending`, `verified`, `rejected` |
| `organizer_id` | query | string | нет |  |  |
| `discipline_id` | query | integer | нет |  |  |
| `contest_level_id` | query | integer | нет |  |  |
| `contest_format_id` | query | integer | нет |  |  |
| `participation_type` | query | string | нет |  | значения: `individual`, `team` |
| `age_group_id` | query | integer | нет |  |  |
| `academic_group_id` | query | integer | нет |  |  |
| `municipality_id` | query | integer | нет |  |  |
| `has_prize_fund` | query | boolean | нет | `False` |  |
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `search` | query | string | нет |  | длина ≤ 200 |
| `sort` | query | string | нет |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/contests`:

```json
{
  "items": [
    {
      "id": 5,
      "title": "Турнир по робототехнике",
      "description": null,
      "discipline": {
        "id": 5,
        "name": "Программирование робототехники"
      },
      "contest_type": {
        "id": 4,
        "name": "Турнир"
      },
      "contest_level": {
        "id": 1,
        "name": "Региональное"
      },
      "contest_format": {
        "id": 1,
        "name": "Очно"
      },
      "participation_type": "team",
      "team_size_min": 2,
      "team_size_max": 2,
      "municipality": {
        "id": 3,
        "name": "г. Новотроицк"
      },
      "venue": null,
      "age_groups": [],
      "academic_groups": [],
      "…": "ещё 26 полей"
    },
    "…ещё элементы"
  ],
  "total": 33
}
```

### `POST /admin/contests`

**Создать соревнование**. Создаёт соревнование от имени федерации, можно с указанием организатора.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 1; длина ≤ 300 |
| `description` | string или null | нет | длина ≤ 10000 |
| `discipline_id` | integer | да | ≥ 1 |
| `contest_type_id` | integer | да | ≥ 1 |
| `contest_level_id` | integer | да | ≥ 1 |
| `contest_format_id` | integer | да | ≥ 1 |
| `participation_type` | string | да | значения: `individual`, `team` |
| `team_size_min` | integer или null | нет | ≥ 1; ≤ 100 |
| `team_size_max` | integer или null | нет | ≥ 1; ≤ 100 |
| `municipality_id` | integer или null | нет | ≥ 1 |
| `venue` | string или null | нет | длина ≤ 500 |
| `age_group_ids` | array | нет | элементов ≤ 20 |
| `academic_group_ids` | array | нет | элементов ≤ 20 |
| `starts_on` | string | да |  |
| `ends_on` | string | да |  |
| `registration_opens_at` | string | да |  |
| `registration_closes_at` | string | да |  |
| `prize_fund_text` | string или null | нет | длина ≤ 500 |
| `prize_fund_amount` | integer или null | нет | ≥ 0 |
| `calendar_plan` | string | нет | значения: `none`, `ekp`, `regional` |
| `calendar_plan_number` | string или null | нет | длина ≤ 50 |
| `regulations_file_id` | string или null | нет |  |
| `photo_file_ids` | array | нет |  |
| `organizer_id` | string или null | нет |  |
| `rating_points` | array или null | нет | элементов ≤ 100 |

```json
{
  "title": "строка",
  "description": "строка",
  "discipline_id": 1,
  "contest_type_id": 1,
  "contest_level_id": 1,
  "contest_format_id": 1,
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality_id": 1,
  "venue": "строка",
  "age_group_ids": [
    1
  ],
  "academic_group_ids": [
    1
  ],
  "starts_on": "2026-11-15",
  "…": "ещё 11 полей"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `GET /admin/contests/rating-points-defaults`

**Баллы за места по умолчанию для уровней**. Возвращает баллы рейтинга по умолчанию за места для каждого уровня соревнований.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/contests/rating-points-defaults`:

```json
[
  {
    "level": {
      "id": 1,
      "name": "Региональное"
    },
    "rating_points": [
      {
        "place": 1,
        "points": 40
      },
      "…ещё элементы"
    ]
  },
  "…ещё элементы"
]
```

### `GET /admin/contests/{contest_id}`

**Соревнование**. Возвращает соревнование по id.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/contests/7`:

```json
{
  "id": 7,
  "title": "Чемпионат Оренбургской области по алгоритмическому программированию",
  "description": "Личный чемпионат области.",
  "discipline": {
    "id": 1,
    "name": "Алгоритмическое программирование"
  },
  "contest_type": {
    "id": 1,
    "name": "Чемпионат"
  },
  "contest_level": {
    "id": 1,
    "name": "Региональное"
  },
  "contest_format": {
    "id": 1,
    "name": "Очно"
  },
  "participation_type": "individual",
  "team_size_min": null,
  "team_size_max": null,
  "municipality": {
    "id": 1,
    "name": "г. Оренбург"
  },
  "venue": "ОГУ, корпус 2",
  "age_groups": [],
  "academic_groups": [],
  "…": "ещё 26 полей"
}
```

### `PATCH /admin/contests/{contest_id}`

**Изменить соревнование**. Обновляет указанные поля соревнования.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string или null | нет | длина ≥ 1; длина ≤ 300 |
| `description` | string или null | нет | длина ≤ 10000 |
| `discipline_id` | integer или null | нет | ≥ 1 |
| `contest_type_id` | integer или null | нет | ≥ 1 |
| `contest_level_id` | integer или null | нет | ≥ 1 |
| `contest_format_id` | integer или null | нет | ≥ 1 |
| `participation_type` | string или null | нет | значения: `individual`, `team` |
| `team_size_min` | integer или null | нет | ≥ 1; ≤ 100 |
| `team_size_max` | integer или null | нет | ≥ 1; ≤ 100 |
| `municipality_id` | integer или null | нет | ≥ 1 |
| `venue` | string или null | нет | длина ≤ 500 |
| `age_group_ids` | array или null | нет | элементов ≤ 20 |
| `academic_group_ids` | array или null | нет | элементов ≤ 20 |
| `starts_on` | string или null | нет |  |
| `ends_on` | string или null | нет |  |
| `registration_opens_at` | string или null | нет |  |
| `registration_closes_at` | string или null | нет |  |
| `prize_fund_text` | string или null | нет | длина ≤ 500 |
| `prize_fund_amount` | integer или null | нет | ≥ 0 |
| `calendar_plan` | string или null | нет | значения: `none`, `ekp`, `regional` |
| `calendar_plan_number` | string или null | нет | длина ≤ 50 |
| `regulations_file_id` | string или null | нет |  |
| `photo_file_ids` | array или null | нет |  |
| `organizer_id` | string или null | нет |  |

```json
{
  "title": "строка",
  "description": "строка",
  "discipline_id": 1,
  "contest_type_id": 1,
  "contest_level_id": 1,
  "contest_format_id": 1,
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality_id": 1,
  "venue": "строка",
  "age_group_ids": [
    1
  ],
  "academic_group_ids": [
    1
  ],
  "starts_on": "2026-11-15",
  "…": "ещё 10 полей"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `DELETE /admin/contests/{contest_id}`

**Удалить соревнование**. Удаляет соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `204` — без тела.

### `POST /admin/contests/{contest_id}/cancel`

**Отменить**. Отменяет соревнование с указанием причины.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/verify`

**Верифицировать**. Верифицирует соревнование, задавая баллы рейтинга за места (или по умолчанию для уровня).

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

```json
{
  "rating_points": [
    {
      "place": 1,
      "points": 1
    }
  ]
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `PATCH /admin/contests/{contest_id}/rating-points`

**Изменить баллы за места**. Пытается изменить баллы рейтинга соревнования; на верифицированном соревновании всегда запрещено.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `rating_points` | array | да | элементов ≤ 100 |

```json
{
  "rating_points": [
    {
      "place": 1,
      "points": 1
    }
  ]
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/reject-verification`

**Отказать в верификации**. Отказывает в верификации соревнования с указанием причины.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/revoke-verification`

**Снять верификацию**. Снимает верификацию с соревнования.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/publish`

**Опубликовать**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/unpublish`

**Снять с публикации**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/open-registration`

**Открыть регистрацию**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/close-registration`

**Закрыть регистрацию**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/start`

**Начать**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/complete`

**Завершить**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `POST /admin/contests/{contest_id}/archive`

**В архив**. Выполняет переход статуса соревнования и возвращает обновлённое соревнование.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "contest_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "contest_format": {
    "id": 1,
    "name": "строка"
  },
  "participation_type": "individual",
  "team_size_min": 1,
  "team_size_max": 1,
  "municipality": {
    "id": 1,
    "name": "строка"
  },
  "venue": "строка",
  "age_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "academic_groups": [
    {
      "id": 1,
      "name": "строка"
    }
  ],
  "…": "ещё 26 полей"
}
```

### `GET /contests/{contest_id}/readiness`

**Чек-лист готовности соревнования**. Возвращает чек-лист готовности соревнования.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/readiness`:

```json
{
  "contest_id": 7,
  "done": 10,
  "total": 11,
  "items": [
    {
      "key": "regulations",
      "step": "prepare",
      "title": "Положение загружено",
      "done": true,
      "hint": "Загрузите положение в карточке соревнования",
      "warning": null
    },
    "…ещё элементы"
  ]
}
```

## Календарь и события

### `GET /calendar/events`

**List Events**. Возвращает опубликованные события и/или соревнования за период с пагинацией.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `online` | query | boolean | нет |  |  |
| `mine` | query | boolean | нет | `False` |  |
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `kind` | query | string | нет |  | значения: `event`, `contest` |
| `q` | query | string | нет | `` | длина ≤ 300 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /calendar/events`:

```json
{
  "items": [
    {
      "kind": "contest",
      "id": "contest-15",
      "contest_id": 15,
      "title": "Командный CTF «Оренбургский рубеж»",
      "description": "",
      "start_date": "2026-10-27",
      "end_date": "2026-10-29",
      "starts_at": null,
      "ends_at": null,
      "location": "г. Оренбург",
      "is_online": false,
      "registration_url": null,
      "status": "in_progress",
      "status_title": "Идёт",
      "…": "ещё 4 полей"
    },
    "…ещё элементы"
  ],
  "total": 9
}
```

### `GET /calendar/events/{event_id}`

**Event Detail**. Возвращает опубликованное событие календаря по id.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `event_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "строка",
  "description": "строка",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": true,
  "registration_url": "строка",
  "status": "draft",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `GET /admin/calendar/events`

**Admin Events**. Возвращает страницу событий календаря для админки с поиском.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет | `` | длина ≤ 300 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/calendar/events`:

```json
{
  "items": [
    {
      "id": "81feced3-a345-43a7-842d-98dad4e451b4",
      "title": "Открытая лекция «Как начать в спортивном программировании»",
      "description": "Для школьников и родителей: дисциплины, соревнования, разряды и с чего начать.",
      "starts_at": "2026-11-07T13:00:00Z",
      "ends_at": "2026-11-07T15:00:00Z",
      "location": "г. Оренбург, ОГУ, конференц-зал",
      "is_online": false,
      "registration_url": null,
      "status": "published",
      "updated_at": "2026-10-28T14:21:27.848354Z"
    },
    "…ещё элементы"
  ],
  "total": 4
}
```

### `POST /admin/calendar/events`

**Create Event**. Создаёт новое событие календаря в статусе «draft».

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 1; длина ≤ 300 |
| `description` | string | нет | длина ≤ 20000 |
| `starts_at` | string | да |  |
| `ends_at` | string | да |  |
| `location` | string или null | нет | длина ≤ 500 |
| `is_online` | boolean | нет |  |
| `registration_url` | string или null | нет | длина ≤ 2048 |

```json
{
  "title": "строка",
  "description": "",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": false,
  "registration_url": "строка"
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "строка",
  "description": "строка",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": true,
  "registration_url": "строка",
  "status": "draft",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `GET /admin/calendar/events/{event_id}`

**Admin Detail**. Возвращает событие календаря по id в любом статусе.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `event_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "строка",
  "description": "строка",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": true,
  "registration_url": "строка",
  "status": "draft",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `PATCH /admin/calendar/events/{event_id}`

**Update Event**. Обновляет переданные поля события календаря.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `event_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string или null | нет | длина ≥ 1; длина ≤ 300 |
| `description` | string или null | нет | длина ≤ 20000 |
| `starts_at` | string или null | нет |  |
| `ends_at` | string или null | нет |  |
| `location` | string или null | нет | длина ≤ 500 |
| `is_online` | boolean или null | нет |  |
| `registration_url` | string или null | нет | длина ≤ 2048 |

```json
{
  "title": "строка",
  "description": "строка",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": true,
  "registration_url": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "строка",
  "description": "строка",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": true,
  "registration_url": "строка",
  "status": "draft",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `POST /admin/calendar/events/{event_id}/{action}`

**Change Status**. Меняет статус события: публикация, снятие с публикации или архивация.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `event_id` | путь | string | да |  |  |
| `action` | путь | string | да |  | значения: `publish`, `unpublish`, `archive` |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "строка",
  "description": "строка",
  "starts_at": "2026-11-15T12:00:00+05:00",
  "ends_at": "2026-11-15T12:00:00+05:00",
  "location": "строка",
  "is_online": true,
  "registration_url": "строка",
  "status": "draft",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

## Заявки

### `GET /contests/{contest_id}/participants`

**Участники соревнования**. Возвращает список участников и команд, допущенных на соревнование.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/participants`:

```json
{
  "items": [
    {
      "team_name": null,
      "members": [
        {
          "last_name": "Соколов",
          "first_name": "Артём",
          "middle_name": "Игоревич"
        }
      ]
    },
    "…ещё элементы"
  ],
  "total_people": 12
}
```

### `GET /athletes/search`

**Найти спортсмена для заявки**. Ищет спортсменов по тексту для добавления в заявку, отмечая проблемы допуска.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | да |  | длина ≤ 200 |
| `contest_id` | query | integer | нет |  |  |

Ответ `200`:

```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "last_name": "строка",
      "first_name": "строка",
      "middle_name": "строка",
      "birth_date": "2026-11-15",
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "problems": [
        "строка"
      ]
    }
  ]
}
```

### `GET /me/available-contests`

**Куда можно записаться**. Возвращает соревнования, открытые для подачи заявки текущим пользователем.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `as` | query | string | нет |  | значения: `athlete`, `coach` |

Ответ `200` — реальный ответ демо-стенда на `GET /me/available-contests`:

```json
{
  "items": [
    {
      "contest": {
        "id": 1,
        "title": "Первенство Оренбургской области по алгоритмическому программированию",
        "discipline": {
          "id": 1,
          "name": "Алгоритмическое программирование"
        },
        "contest_level": {
          "id": 1,
          "name": "Региональное"
        },
        "contest_format": {
          "id": 1,
          "name": "Очно"
        },
        "participation_type": "individual",
        "team_size_min": null,
        "team_size_max": null,
        "municipality": {
          "id": 1,
          "name": "г. Оренбург"
        },
        "venue": "ОГУ, пр. Победы, 13, корпус 2",
        "age_groups": [
          {
            "id": 2,
            "name": "14–17 лет"
          }
        ],
        "academic_groups": [],
        "starts_on": "2026-11-18",
        "ends_on": "2026-11-19",
        "…": "ещё 9 полей"
      },
      "problems": [
        "возраст на дату соревнования 20, не подходит по возрастным группам"
      ]
    },
    "…ещё элементы"
  ]
}
```

### `GET /me/applications`

**Мои заявки**. Возвращает заявки текущего пользователя как спортсмена или как тренера.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `as` | query | string | нет |  | значения: `athlete`, `coach` |

Ответ `200` — реальный ответ демо-стенда на `GET /me/applications`:

```json
{
  "items": [
    {
      "id": 36,
      "contest": {
        "id": 11,
        "title": "Открытый турнир ОГУ по алгоритмическому программированию",
        "discipline": {
          "id": 1,
          "name": "Алгоритмическое программирование"
        },
        "contest_level": {
          "id": 1,
          "name": "Региональное"
        },
        "contest_format": {
          "id": 2,
          "name": "Онлайн"
        },
        "participation_type": "individual",
        "team_size_min": null,
        "team_size_max": null,
        "municipality": null,
        "venue": null,
        "age_groups": [],
        "academic_groups": [],
        "starts_on": "2026-08-14",
        "ends_on": "2026-08-14",
        "…": "ещё 9 полей"
      },
      "team_name": null,
      "status": "approved",
      "created_as": "athlete",
      "creator": {
        "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
        "last_name": "Соколов",
        "first_name": "Артём",
        "middle_name": "Игоревич"
      },
      "reject_reason": null,
      "submitted_at": "2026-08-09T12:00:00Z",
      "decided_at": "2026-08-09T12:00:00Z",
      "created_at": "2026-10-28T14:21:27.848354Z",
      "members": [
        {
          "user": {
            "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
            "last_name": "Соколов",
            "first_name": "Артём",
            "middle_name": "Игоревич",
            "birth_date": "2006-03-01",
            "academic_group": {
              "id": 4,
              "name": "Студенты"
            }
          },
          "is_captain": true,
          "confirmation": "confirmed",
          "is_active": true,
          "age_group": {
            "id": 3,
            "name": "18 лет и старше"
          },
          "academic_group": {
            "id": 4,
            "name": "Студенты"
          },
          "responded_at": "2026-08-09T12:00:00Z",
          "confirmation_title": "Подтвердил"
        }
      ],
      "status_title": "Одобрена"
    },
    "…ещё элементы"
  ]
}
```

### `POST /contests/{contest_id}/applications`

**Подать заявку**. Создаёт новую заявку на соревнование.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `as` | string | да | значения: `athlete`, `coach` |
| `team_name` | string или null | нет | длина ≥ 1; длина ≤ 100 |
| `member_ids` | array | нет | элементов ≤ 100 |
| `captain_id` | string или null | нет |  |

```json
{
  "as": "athlete",
  "team_name": "строка",
  "member_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ],
  "captain_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /contests/{contest_id}/applications/batch`

**Тренер: личные заявки сразу на нескольких спортсменов**. Тренер создаёт личные заявки сразу на нескольких указанных спортсменов.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `member_ids` | array | да | элементов ≤ 100 |

```json
{
  "member_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
```

Ответ `201`:

```json
{
  "items": [
    {
      "id": 1,
      "contest": {
        "id": 1,
        "title": "строка",
        "discipline": {
          "id": 1,
          "name": "строка"
        },
        "contest_level": {
          "id": 1,
          "name": "строка"
        },
        "contest_format": {
          "id": 1,
          "name": "строка"
        },
        "participation_type": "individual",
        "team_size_min": 1,
        "team_size_max": 1,
        "municipality": {
          "id": 1,
          "name": "строка"
        },
        "venue": "строка",
        "age_groups": [
          {
            "id": "…",
            "name": "…"
          }
        ],
        "academic_groups": [
          {
            "id": "…",
            "name": "…"
          }
        ],
        "starts_on": "2026-11-15",
        "ends_on": "2026-11-15",
        "…": "ещё 9 полей"
      },
      "team_name": "строка",
      "status": "forming",
      "created_as": "athlete",
      "creator": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка"
      },
      "reject_reason": "строка",
      "submitted_at": "2026-11-15T12:00:00+05:00",
      "decided_at": "2026-11-15T12:00:00+05:00",
      "created_at": "2026-11-15T12:00:00+05:00",
      "members": [
        {
          "user": {
            "id": "…",
            "last_name": "…",
            "first_name": "…",
            "middle_name": "…",
            "birth_date": "…",
            "academic_group": "…"
          },
          "is_captain": true,
          "confirmation": "invited",
          "is_active": true,
          "age_group": {
            "id": "…",
            "name": "…"
          },
          "academic_group": {
            "id": "…",
            "name": "…"
          },
          "responded_at": "2026-11-15T12:00:00+05:00",
          "confirmation_title": "строка"
        }
      ],
      "status_title": "строка"
    }
  ]
}
```

### `POST /contests/{contest_id}/applications/repeat`

**Подать заявку тем же составом, что на прошлом соревновании**. Повторяет свою прошлую заявку тем же составом на новом соревновании.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `source_application_id` | integer | да | ≥ 1 |

```json
{
  "source_application_id": 1
}
```

Ответ `201`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `GET /applications/{application_id}`

**Заявка**. Возвращает заявку по id, если у пользователя есть право её видеть.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /applications/36`:

```json
{
  "id": 36,
  "contest": {
    "id": 11,
    "title": "Открытый турнир ОГУ по алгоритмическому программированию",
    "discipline": {
      "id": 1,
      "name": "Алгоритмическое программирование"
    },
    "contest_level": {
      "id": 1,
      "name": "Региональное"
    },
    "contest_format": {
      "id": 2,
      "name": "Онлайн"
    },
    "participation_type": "individual",
    "team_size_min": null,
    "team_size_max": null,
    "municipality": null,
    "venue": null,
    "age_groups": [],
    "academic_groups": [],
    "starts_on": "2026-08-14",
    "ends_on": "2026-08-14",
    "…": "ещё 9 полей"
  },
  "team_name": null,
  "status": "approved",
  "created_as": "athlete",
  "creator": {
    "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
    "last_name": "Соколов",
    "first_name": "Артём",
    "middle_name": "Игоревич"
  },
  "reject_reason": null,
  "submitted_at": "2026-08-09T12:00:00Z",
  "decided_at": "2026-08-09T12:00:00Z",
  "created_at": "2026-10-28T14:21:27.848354Z",
  "members": [
    {
      "user": {
        "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
        "last_name": "Соколов",
        "first_name": "Артём",
        "middle_name": "Игоревич",
        "birth_date": "2006-03-01",
        "academic_group": {
          "id": 4,
          "name": "Студенты"
        }
      },
      "is_captain": true,
      "confirmation": "confirmed",
      "is_active": true,
      "age_group": {
        "id": 3,
        "name": "18 лет и старше"
      },
      "academic_group": {
        "id": 4,
        "name": "Студенты"
      },
      "responded_at": "2026-08-09T12:00:00Z",
      "confirmation_title": "Подтвердил"
    }
  ],
  "status_title": "Одобрена"
}
```

### `PATCH /applications/{application_id}`

**Переименовать команду**. Переименовывает команду в заявке.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `team_name` | string | да | длина ≥ 1; длина ≤ 100 |

```json
{
  "team_name": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /applications/{application_id}/members`

**Пригласить в команду**. Приглашает спортсмена в состав командной заявки.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `user_id` | string | да |  |

```json
{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `DELETE /applications/{application_id}/members/{user_id}`

**Убрать из команды**. Убирает участника из командной заявки.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |
| `user_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /applications/{application_id}/submit`

**Подать на рассмотрение**. Подаёт заявку на модерацию.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /applications/{application_id}/withdraw`

**Отозвать заявку**. Отзывает заявку целиком.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /applications/{application_id}/confirm`

**Подтвердить участие**. Подтверждает участие в заявке.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /applications/{application_id}/decline`

**Отказаться от участия**. Отказывается от участия в заявке.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest": {
    "id": 1,
    "title": "строка",
    "discipline": {
      "id": 1,
      "name": "строка"
    },
    "contest_level": {
      "id": 1,
      "name": "строка"
    },
    "contest_format": {
      "id": 1,
      "name": "строка"
    },
    "participation_type": "individual",
    "team_size_min": 1,
    "team_size_max": 1,
    "municipality": {
      "id": 1,
      "name": "строка"
    },
    "venue": "строка",
    "age_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "academic_groups": [
      {
        "id": 1,
        "name": "строка"
      }
    ],
    "starts_on": "2026-11-15",
    "ends_on": "2026-11-15",
    "…": "ещё 9 полей"
  },
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка"
  },
  "reject_reason": "строка",
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15",
        "academic_group": {
          "id": 1,
          "name": "строка"
        }
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "responded_at": "2026-11-15T12:00:00+05:00",
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `GET /organizer/applications/contests`

**Соревнования с заявками**. Возвращает соревнования с количеством заявок по статусам.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /organizer/applications/contests`:

```json
{
  "items": [
    {
      "contest": {
        "id": 16,
        "title": "Кубок Оренбуржья по алгоритмическому программированию, этап 1",
        "discipline": {
          "id": 1,
          "name": "Алгоритмическое программирование"
        },
        "participation_type": "individual",
        "team_size_min": null,
        "team_size_max": null,
        "starts_on": "2024-11-27",
        "ends_on": "2024-11-27",
        "registration_closes_at": "2024-11-25T23:59:00Z",
        "status": "completed",
        "organizer": {
          "id": "db3c3012-5e3e-48ec-b6e7-c87a389d48db",
          "email": "organizer@example.test",
          "last_name": "Организаторова",
          "first_name": "Елена",
          "middle_name": "Павловна",
          "birth_date": "1988-01-20"
        },
        "status_title": "Завершено",
        "participation_type_title": "Личное"
      },
      "counts": {
        "forming": 0,
        "submitted": 0,
        "approved": 6,
        "rejected": 1,
        "withdrawn": 1
      }
    },
    "…ещё элементы"
  ],
  "total": 20
}
```

### `GET /organizer/contests/{contest_id}/applications`

**Заявки соревнования**. Возвращает список заявок соревнования с фильтром по статусу и поисковой строкой.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `status` | query | string | нет |  | значения: `forming`, `submitted`, `approved`, `rejected`, `withdrawn` |
| `search` | query | string | нет |  | длина ≤ 200 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200`:

```json
{
  "items": [
    {
      "id": 1,
      "contest_id": 1,
      "team_name": "строка",
      "status": "forming",
      "created_as": "athlete",
      "creator": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "reject_reason": "строка",
      "decided_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "submitted_at": "2026-11-15T12:00:00+05:00",
      "decided_at": "2026-11-15T12:00:00+05:00",
      "created_at": "2026-11-15T12:00:00+05:00",
      "members": [
        {
          "user": {
            "id": "…",
            "email": "…",
            "last_name": "…",
            "first_name": "…",
            "middle_name": "…",
            "birth_date": "…"
          },
          "is_captain": true,
          "confirmation": "invited",
          "is_active": true,
          "age_group": {
            "id": "…",
            "name": "…"
          },
          "academic_group": {
            "id": "…",
            "name": "…"
          },
          "confirmation_title": "строка"
        }
      ],
      "status_title": "строка"
    }
  ],
  "total": 1
}
```

### `POST /organizer/applications/approve`

**Одобрить несколько**. Одобряет несколько заявок списком id.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `ids` | array | да | элементов ≤ 200 |

```json
{
  "ids": [
    1
  ]
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "id": 1,
      "contest_id": 1,
      "team_name": "строка",
      "status": "forming",
      "created_as": "athlete",
      "creator": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "reject_reason": "строка",
      "decided_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "submitted_at": "2026-11-15T12:00:00+05:00",
      "decided_at": "2026-11-15T12:00:00+05:00",
      "created_at": "2026-11-15T12:00:00+05:00",
      "members": [
        {
          "user": {
            "id": "…",
            "email": "…",
            "last_name": "…",
            "first_name": "…",
            "middle_name": "…",
            "birth_date": "…"
          },
          "is_captain": true,
          "confirmation": "invited",
          "is_active": true,
          "age_group": {
            "id": "…",
            "name": "…"
          },
          "academic_group": {
            "id": "…",
            "name": "…"
          },
          "confirmation_title": "строка"
        }
      ],
      "status_title": "строка"
    }
  ]
}
```

### `POST /organizer/applications/reject`

**Отклонить несколько**. Отклоняет несколько заявок списком id с одной общей причиной.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `ids` | array | да | элементов ≤ 200 |
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "ids": [
    1
  ],
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "id": 1,
      "contest_id": 1,
      "team_name": "строка",
      "status": "forming",
      "created_as": "athlete",
      "creator": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "reject_reason": "строка",
      "decided_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "submitted_at": "2026-11-15T12:00:00+05:00",
      "decided_at": "2026-11-15T12:00:00+05:00",
      "created_at": "2026-11-15T12:00:00+05:00",
      "members": [
        {
          "user": {
            "id": "…",
            "email": "…",
            "last_name": "…",
            "first_name": "…",
            "middle_name": "…",
            "birth_date": "…"
          },
          "is_captain": true,
          "confirmation": "invited",
          "is_active": true,
          "age_group": {
            "id": "…",
            "name": "…"
          },
          "academic_group": {
            "id": "…",
            "name": "…"
          },
          "confirmation_title": "строка"
        }
      ],
      "status_title": "строка"
    }
  ]
}
```

### `POST /organizer/applications/{application_id}/approve`

**Одобрить**. Одобряет одну заявку.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest_id": 1,
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "reject_reason": "строка",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /organizer/applications/{application_id}/reject`

**Отклонить**. Отклоняет одну заявку с указанием причины.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "contest_id": 1,
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "reject_reason": "строка",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /organizer/applications/{application_id}/reset`

**Вернуть на рассмотрение**. Возвращает решённую заявку в статус «подана».

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest_id": 1,
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "reject_reason": "строка",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `GET /admin/applications/contests`

**Соревнования с заявками**. Возвращает соревнования с количеством заявок по статусам.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/applications/contests`:

```json
{
  "items": [
    {
      "contest": {
        "id": 16,
        "title": "Кубок Оренбуржья по алгоритмическому программированию, этап 1",
        "discipline": {
          "id": 1,
          "name": "Алгоритмическое программирование"
        },
        "participation_type": "individual",
        "team_size_min": null,
        "team_size_max": null,
        "starts_on": "2024-11-27",
        "ends_on": "2024-11-27",
        "registration_closes_at": "2024-11-25T23:59:00Z",
        "status": "completed",
        "organizer": {
          "id": "db3c3012-5e3e-48ec-b6e7-c87a389d48db",
          "email": "organizer@example.test",
          "last_name": "Организаторова",
          "first_name": "Елена",
          "middle_name": "Павловна",
          "birth_date": "1988-01-20"
        },
        "status_title": "Завершено",
        "participation_type_title": "Личное"
      },
      "counts": {
        "forming": 0,
        "submitted": 0,
        "approved": 6,
        "rejected": 1,
        "withdrawn": 1
      }
    },
    "…ещё элементы"
  ],
  "total": 25
}
```

### `GET /admin/contests/{contest_id}/applications`

**Заявки соревнования**. Возвращает список заявок соревнования с фильтром по статусу и поисковой строкой.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `status` | query | string | нет |  | значения: `forming`, `submitted`, `approved`, `rejected`, `withdrawn` |
| `search` | query | string | нет |  | длина ≤ 200 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/contests/7/applications`:

```json
{
  "items": [
    {
      "id": 1,
      "contest_id": 7,
      "team_name": null,
      "status": "approved",
      "created_as": "athlete",
      "creator": {
        "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
        "email": "athlete@example.test",
        "last_name": "Соколов",
        "first_name": "Артём",
        "middle_name": "Игоревич",
        "birth_date": "2006-03-01"
      },
      "reject_reason": null,
      "decided_by": {
        "id": "672200af-4873-474f-8f77-39393c4563c0",
        "email": "federation@example.test",
        "last_name": "Федеральцев",
        "first_name": "Олег",
        "middle_name": "Викторович",
        "birth_date": "1980-04-12"
      },
      "submitted_at": "2026-06-25T12:00:00Z",
      "decided_at": "2026-06-25T12:00:00Z",
      "created_at": "2026-10-28T14:21:27.848354Z",
      "members": [
        {
          "user": {
            "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
            "email": "athlete@example.test",
            "last_name": "Соколов",
            "first_name": "Артём",
            "middle_name": "Игоревич",
            "birth_date": "2006-03-01"
          },
          "is_captain": true,
          "confirmation": "confirmed",
          "is_active": true,
          "age_group": {
            "id": 3,
            "name": "18 лет и старше"
          },
          "academic_group": {
            "id": 4,
            "name": "Студенты"
          },
          "confirmation_title": "Подтвердил"
        }
      ],
      "status_title": "Одобрена"
    },
    "…ещё элементы"
  ],
  "total": 12
}
```

### `POST /admin/applications/approve`

**Одобрить несколько**. Одобряет несколько заявок списком id.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `ids` | array | да | элементов ≤ 200 |

```json
{
  "ids": [
    1
  ]
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "id": 1,
      "contest_id": 1,
      "team_name": "строка",
      "status": "forming",
      "created_as": "athlete",
      "creator": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "reject_reason": "строка",
      "decided_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "submitted_at": "2026-11-15T12:00:00+05:00",
      "decided_at": "2026-11-15T12:00:00+05:00",
      "created_at": "2026-11-15T12:00:00+05:00",
      "members": [
        {
          "user": {
            "id": "…",
            "email": "…",
            "last_name": "…",
            "first_name": "…",
            "middle_name": "…",
            "birth_date": "…"
          },
          "is_captain": true,
          "confirmation": "invited",
          "is_active": true,
          "age_group": {
            "id": "…",
            "name": "…"
          },
          "academic_group": {
            "id": "…",
            "name": "…"
          },
          "confirmation_title": "строка"
        }
      ],
      "status_title": "строка"
    }
  ]
}
```

### `POST /admin/applications/reject`

**Отклонить несколько**. Отклоняет несколько заявок списком id с одной общей причиной.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `ids` | array | да | элементов ≤ 200 |
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "ids": [
    1
  ],
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "id": 1,
      "contest_id": 1,
      "team_name": "строка",
      "status": "forming",
      "created_as": "athlete",
      "creator": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "reject_reason": "строка",
      "decided_by": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "submitted_at": "2026-11-15T12:00:00+05:00",
      "decided_at": "2026-11-15T12:00:00+05:00",
      "created_at": "2026-11-15T12:00:00+05:00",
      "members": [
        {
          "user": {
            "id": "…",
            "email": "…",
            "last_name": "…",
            "first_name": "…",
            "middle_name": "…",
            "birth_date": "…"
          },
          "is_captain": true,
          "confirmation": "invited",
          "is_active": true,
          "age_group": {
            "id": "…",
            "name": "…"
          },
          "academic_group": {
            "id": "…",
            "name": "…"
          },
          "confirmation_title": "строка"
        }
      ],
      "status_title": "строка"
    }
  ]
}
```

### `POST /admin/applications/{application_id}/approve`

**Одобрить**. Одобряет одну заявку.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest_id": 1,
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "reject_reason": "строка",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /admin/applications/{application_id}/reject`

**Отклонить**. Отклоняет одну заявку с указанием причины.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "contest_id": 1,
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "reject_reason": "строка",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

### `POST /admin/applications/{application_id}/reset`

**Вернуть на рассмотрение**. Возвращает решённую заявку в статус «подана».

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `application_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "id": 1,
  "contest_id": 1,
  "team_name": "строка",
  "status": "forming",
  "created_as": "athlete",
  "creator": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "reject_reason": "строка",
  "decided_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "строка",
    "last_name": "строка",
    "first_name": "строка",
    "middle_name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_at": "2026-11-15T12:00:00+05:00",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "members": [
    {
      "user": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "строка",
        "last_name": "строка",
        "first_name": "строка",
        "middle_name": "строка",
        "birth_date": "2026-11-15"
      },
      "is_captain": true,
      "confirmation": "invited",
      "is_active": true,
      "age_group": {
        "id": 1,
        "name": "строка"
      },
      "academic_group": {
        "id": 1,
        "name": "строка"
      },
      "confirmation_title": "строка"
    }
  ],
  "status_title": "строка"
}
```

## Места и протокол

### `GET /contests/{contest_id}/results`

**Места соревнования**. Возвращает итоговые места соревнования, сгруппированные по заявкам.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/results`:

```json
{
  "participation_type": "individual",
  "is_verified": true,
  "items": [
    {
      "place": 1,
      "points": 40,
      "team_name": null,
      "athletes": [
        {
          "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
          "full_name": "Соколов Артём Игоревич"
        }
      ]
    },
    "…ещё элементы"
  ]
}
```

### `GET /organizer/contests/{contest_id}/results`

**Места: форма**. Возвращает форму внесения мест по соревнованию.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`:

```json
{
  "contest_id": 1,
  "status": "draft",
  "participation_type": "individual",
  "editable": true,
  "items": [
    {
      "application_id": 1,
      "team_name": "строка",
      "athletes": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "full_name": "строка"
        }
      ],
      "entered": true,
      "place": 1
    }
  ]
}
```

### `PUT /organizer/contests/{contest_id}/results`

**Внести места**. Сохраняет места участников и возвращает обновлённую форму.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `items` | array | да | элементов ≤ 5000 |
| `source` | string или null | нет | длина ≤ 200 |

```json
{
  "items": [
    {
      "application_id": 1,
      "place": 1
    }
  ],
  "source": "строка"
}
```

Ответ `200`:

```json
{
  "contest_id": 1,
  "status": "draft",
  "participation_type": "individual",
  "editable": true,
  "items": [
    {
      "application_id": 1,
      "team_name": "строка",
      "athletes": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "full_name": "строка"
        }
      ],
      "entered": true,
      "place": 1
    }
  ]
}
```

### `POST /organizer/contests/{contest_id}/results/import`

**Импорт протокола из xlsx или PDF: предпросмотр**. Сопоставляет строки протокола с одобренными заявками; места сохраняются отдельно через PUT results.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса: `multipart/form-data`, поле `file` — файл.

Ответ `200`:

```json
{
  "file_name": "строка",
  "matched": 1,
  "doubtful": 1,
  "unmatched": 1,
  "rows": [
    {
      "line": 1,
      "name": "строка",
      "place": 1,
      "disqualified": true,
      "points": "строка",
      "status": "matched",
      "application_id": 1,
      "candidates": [
        1
      ],
      "note": "строка"
    }
  ],
  "entries": [
    {
      "application_id": 1,
      "team_name": "строка",
      "athletes": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "full_name": "строка"
        }
      ],
      "entered": true,
      "place": 1
    }
  ],
  "missing": [
    1
  ]
}
```

### `GET /organizer/contests/{contest_id}/results/protocol.xlsx`

**Протокол xlsx**. Отдаёт xlsx-протокол соревнования файлом.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`: файл или редирект.

### `GET /admin/contests/{contest_id}/results`

**Места: форма**. Возвращает форму внесения мест по соревнованию.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/contests/7/results`:

```json
{
  "contest_id": 7,
  "status": "completed",
  "participation_type": "individual",
  "editable": true,
  "items": [
    {
      "application_id": 1,
      "team_name": null,
      "athletes": [
        {
          "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
          "full_name": "Соколов Артём Игоревич"
        }
      ],
      "entered": true,
      "place": 1
    },
    "…ещё элементы"
  ]
}
```

### `PUT /admin/contests/{contest_id}/results`

**Внести места**. Сохраняет места участников и возвращает обновлённую форму.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `items` | array | да | элементов ≤ 5000 |
| `source` | string или null | нет | длина ≤ 200 |

```json
{
  "items": [
    {
      "application_id": 1,
      "place": 1
    }
  ],
  "source": "строка"
}
```

Ответ `200`:

```json
{
  "contest_id": 1,
  "status": "draft",
  "participation_type": "individual",
  "editable": true,
  "items": [
    {
      "application_id": 1,
      "team_name": "строка",
      "athletes": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "full_name": "строка"
        }
      ],
      "entered": true,
      "place": 1
    }
  ]
}
```

### `POST /admin/contests/{contest_id}/results/import`

**Импорт протокола из xlsx или PDF: предпросмотр**. Сопоставляет строки протокола с одобренными заявками; места сохраняются отдельно через PUT results.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса: `multipart/form-data`, поле `file` — файл.

Ответ `200`:

```json
{
  "file_name": "строка",
  "matched": 1,
  "doubtful": 1,
  "unmatched": 1,
  "rows": [
    {
      "line": 1,
      "name": "строка",
      "place": 1,
      "disqualified": true,
      "points": "строка",
      "status": "matched",
      "application_id": 1,
      "candidates": [
        1
      ],
      "note": "строка"
    }
  ],
  "entries": [
    {
      "application_id": 1,
      "team_name": "строка",
      "athletes": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "full_name": "строка"
        }
      ],
      "entered": true,
      "place": 1
    }
  ],
  "missing": [
    1
  ]
}
```

### `GET /admin/contests/{contest_id}/results/protocol.xlsx`

**Протокол xlsx**. Отдаёт xlsx-протокол соревнования файлом.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200`: файл или редирект.

## Рейтинг и сборные

### `GET /ratings`

**Все рейтинги**. Возвращает топ рейтинговых таблиц по всем дисциплинам и группам.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `group_kind` | query | string | нет |  | значения: `age`, `academic` |
| `min_rank_id` | query | integer | нет |  | Не ниже этого разряда: id из справочника разрядов; ≥ 1 |
| `limit` | query | integer | нет | `10` | ≥ 1, ≤ 50 |

Ответ `200` — реальный ответ демо-стенда на `GET /ratings`:

```json
{
  "items": [
    {
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "group_kind": "age",
      "group": {
        "id": 1,
        "name": "До 14 лет"
      },
      "total": 8,
      "items": [
        {
          "place": 1,
          "athlete": {
            "id": "0a60be8d-6cc2-4ea0-b4c6-db9aa614a1fa",
            "full_name": "Орлова Злата Викторовна"
          },
          "municipality": {
            "id": 4,
            "name": "г. Бузулук"
          },
          "points": 60,
          "contests": 3,
          "base": 50,
          "podiums": 2,
          "factor": 1.2,
          "explain": "30 + 20 + 0 = 50 × 1,2 = 60"
        },
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ]
}
```

### `GET /ratings/settings`

**Правила подсчёта рейтинга**. Возвращает действующие правила рейтинга и начало текущего сезона.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /ratings/settings`:

```json
{
  "stability_factor": 1.2,
  "podium_place": 3,
  "podium_count": 2,
  "season": "rolling",
  "season_title": "Последние 365 дней",
  "since": "2025-10-28",
  "formula": "Сумма баллов за места на верифицированных соревнованиях за период «последние 365 дней». Призёрам (места 1–3) не менее…"
}
```

### `GET /ratings/table`

**Рейтинг целиком**. Возвращает страницу полной рейтинговой таблицы по дисциплине и группе с поиском по имени.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `discipline_id` | query | integer | да |  | ≥ 1 |
| `group_kind` | query | string | да |  | значения: `age`, `academic` |
| `group_id` | query | integer | да |  | ≥ 1 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `min_rank_id` | query | integer | нет |  | Не ниже этого разряда: id из справочника разрядов; ≥ 1 |
| `search` | query | string | нет |  | длина ≤ 200 |
| `limit` | query | integer | нет | `50` | ≥ 1, ≤ 200 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200`:

```json
{
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "group_kind": "age",
  "group": {
    "id": 1,
    "name": "строка"
  },
  "total": 1,
  "items": [
    {
      "place": 1,
      "athlete": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "строка"
      },
      "municipality": {
        "id": 1,
        "name": "строка"
      },
      "points": 1,
      "contests": 1,
      "base": 1,
      "podiums": 1,
      "factor": 1.0,
      "explain": "строка"
    }
  ]
}
```

### `GET /ratings/me`

**Моё место в рейтингах или почему меня там нет**. Возвращает положение текущего пользователя в рейтингах и причины, по которым его нет в части из них.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /ratings/me`:

```json
{
  "rules": {
    "stability_factor": 1.2,
    "podium_place": 3,
    "podium_count": 2,
    "season": "rolling",
    "season_title": "Последние 365 дней",
    "since": "2025-10-28",
    "formula": "Сумма баллов за места на верифицированных соревнованиях за период «последние 365 дней». Призёрам (места 1–3) не менее…"
  },
  "in_rating": true,
  "standings": [
    {
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "group_kind": "age",
      "group": {
        "id": 3,
        "name": "18 лет и старше"
      },
      "place": 2,
      "total": 8,
      "points": 102,
      "contests": 3,
      "base": 85,
      "podiums": 2,
      "factor": 1.2,
      "explain": "45 + 40 + 0 = 85 × 1,2 = 102",
      "scores": [
        {
          "contest": {
            "id": 11,
            "title": "Открытый турнир ОГУ по алгоритмическому программированию",
            "ends_on": "2026-08-14"
          },
          "place": 5,
          "points": 0
        },
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ],
  "reasons": []
}
```

### `GET /ratings/athletes/{user_id}`

**Положение спортсмена в рейтингах**. Возвращает положение спортсмена во всех рейтингах с историей его результатов.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /ratings/athletes/bc167364-0988-4783-8e6c-5fb9d55162e8`:

```json
{
  "items": [
    {
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "group_kind": "age",
      "group": {
        "id": 3,
        "name": "18 лет и старше"
      },
      "place": 2,
      "total": 8,
      "points": 102,
      "contests": 3,
      "base": 85,
      "podiums": 2,
      "factor": 1.2,
      "explain": "45 + 40 + 0 = 85 × 1,2 = 102",
      "scores": [
        {
          "contest": {
            "id": 11,
            "title": "Открытый турнир ОГУ по алгоритмическому программированию",
            "ends_on": "2026-08-14"
          },
          "place": 5,
          "points": 0
        },
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ]
}
```

### `PUT /admin/ratings/settings`

**Изменить правила подсчёта рейтинга**. Сохраняет коэффициент стабильности, порог призёров и вид сезона.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `stability_factor` | number или string | да | ≥ 1; ≤ 3 |
| `podium_place` | integer | да | ≥ 1; ≤ 10 |
| `podium_count` | integer | да | ≥ 1; ≤ 10 |
| `season` | string | да | значения: `rolling`, `calendar` |

```json
{
  "stability_factor": 1.0,
  "podium_place": 1,
  "podium_count": 1,
  "season": "rolling"
}
```

Ответ `200`:

```json
{
  "stability_factor": 1.0,
  "podium_place": 1,
  "podium_count": 1,
  "season": "rolling",
  "season_title": "строка",
  "since": "2026-11-15",
  "formula": "строка"
}
```

### `GET /squads`

**Действующие сборные**. Возвращает действующие сборные по фильтру дисциплины и группы.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `group_kind` | query | string | нет |  | значения: `age`, `academic` |
| `group_id` | query | integer | нет |  | ≥ 1 |

Ответ `200` — реальный ответ демо-стенда на `GET /squads`:

```json
{
  "items": [
    {
      "id": 1,
      "title": "Сборная Оренбургской области · Алгоритмическое программирование · 14–17 лет",
      "discipline": {
        "id": 1,
        "name": "Алгоритмическое программирование"
      },
      "group_kind": "age",
      "group": {
        "id": 2,
        "name": "14–17 лет"
      },
      "main_size": 3,
      "reserve_size": 2,
      "order": {
        "number": "17-сб",
        "date": "2026-10-08",
        "url": "http://localhost:9100/fsp-public/orders/squads/alg-14-17.pdf",
        "file_name": "alg-14-17.pdf"
      },
      "approved_at": "2026-10-28T14:21:27.848354Z",
      "main": [
        {
          "position": 1,
          "athlete": {
            "id": "9202ecc8-93bf-4633-9219-6ea8ee6aee79",
            "name": "Морозова Дарья Ильинична"
          },
          "municipality": {
            "id": 3,
            "name": "г. Новотроицк"
          },
          "points": 90
        },
        "…ещё элементы"
      ],
      "reserve": [
        {
          "position": 4,
          "athlete": {
            "id": "c025ade8-d0ea-436e-aca7-7dd6afd2292f",
            "name": "Волков Егор Денисович"
          },
          "municipality": {
            "id": 2,
            "name": "г. Орск"
          },
          "points": 30
        },
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ]
}
```

### `GET /squads/members/{user_id}`

**Сборные человека: метки для его страницы**. Возвращает метки сборных, в которых состоит пользователь, для его страницы.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /squads/members/bc167364-0988-4783-8e6c-5fb9d55162e8`:

```json
{
  "items": []
}
```

### `GET /admin/squads/candidates`

**Кто войдёт в сборную, если утвердить сейчас**. Показывает, кто войдёт в основной состав и резерв сборной; исключённых вручную заменяют следующие по рейтингу.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `discipline_id` | query | integer | да |  | ≥ 1 |
| `group_kind` | query | string | да |  | значения: `age`, `academic` |
| `group_id` | query | integer | да |  | ≥ 1 |
| `main_size` | query | integer | да |  | ≥ 1, ≤ 100 |
| `reserve_size` | query | integer | нет | `0` | ≤ 100 |
| `min_rank_id` | query | integer | нет |  | ≥ 1 |
| `exclude_ids` | query | array | нет |  |  |

Ответ `200`:

```json
{
  "title": "строка",
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "group_kind": "age",
  "group": {
    "id": 1,
    "name": "строка"
  },
  "main_size": 1,
  "reserve_size": 1,
  "available": 1,
  "main": [
    {
      "position": 1,
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "municipality": {
        "id": 1,
        "name": "строка"
      },
      "points": 1
    }
  ],
  "reserve": [
    {
      "position": 1,
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "municipality": {
        "id": 1,
        "name": "строка"
      },
      "points": 1
    }
  ],
  "excluded": [
    {
      "position": 1,
      "athlete_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "municipality": {
        "id": 1,
        "name": "строка"
      },
      "points": 1
    }
  ],
  "current": {
    "id": 1,
    "order_number": "строка",
    "order_date": "2026-11-15",
    "main": 1,
    "reserve": 1
  }
}
```

### `GET /admin/squads/order-draft.pdf`

**Список сборной и проект приказа, PDF**. Формирует по текущему черновику состава PDF со списком сборной и проектом приказа.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `discipline_id` | query | integer | да |  | ≥ 1 |
| `group_kind` | query | string | да |  | значения: `age`, `academic` |
| `group_id` | query | integer | да |  | ≥ 1 |
| `main_size` | query | integer | да |  | ≥ 1, ≤ 100 |
| `reserve_size` | query | integer | нет | `0` | ≤ 100 |
| `min_rank_id` | query | integer | нет |  | ≥ 1 |
| `exclude_ids` | query | array | нет |  |  |
| `order_number` | query | string | нет |  | длина ≤ 100 |
| `order_date` | query | string | нет |  |  |

Ответ `200`: файл или редирект.

### `POST /admin/squads`

**Утвердить сборную по приказу (заменяет действующую)**. Утверждает состав сборной приказом, заменяя действующую сборную этой группы.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `discipline_id` | integer | да | ≥ 1 |
| `group_kind` | string | да | значения: `age`, `academic` |
| `group_id` | integer | да | ≥ 1 |
| `main_size` | integer | да | ≥ 1; ≤ 100 |
| `reserve_size` | integer | да | ≥ 0; ≤ 100 |
| `order_number` | string | да | длина ≤ 100 |
| `order_date` | string | да |  |
| `order_file_id` | string | да |  |
| `min_rank_id` | integer или null | нет | ≥ 1 |
| `exclude_ids` | array | нет | элементов ≤ 100 |

```json
{
  "discipline_id": 1,
  "group_kind": "age",
  "group_id": 1,
  "main_size": 1,
  "reserve_size": 1,
  "order_number": "строка",
  "order_date": "2026-11-15",
  "order_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "min_rank_id": 1,
  "exclude_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
```

Ответ `201`:

```json
{
  "id": 1,
  "title": "строка",
  "link": "строка",
  "main": 1,
  "reserve": 1
}
```

### `DELETE /admin/squads/{squad_id}`

**Расформировать сборную**. Расформировывает сборную.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `squad_id` | путь | integer | да |  | ≥ 1 |

Ответ `204` — без тела.

## Документы и отчёты

### `GET /contests/{contest_id}/documents`

**Документы соревнования**. Отдаёт документы соревнования, сгруппированные по виду.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/documents`:

```json
{
  "items": [
    {
      "kind": "certificate",
      "kind_title": "Сертификаты участников",
      "form": {
        "title": "Сертификат",
        "lead": "подтверждает, что",
        "text": "принял(а) участие в соревновании",
        "recipients": "participants",
        "places_to": 3,
        "signer_position": "Председатель регионального отделения ФСП",
        "signer_name": "О. В. Федеральцев",
        "issued_on": "2026-07-03"
      },
      "items": [
        {
          "token": "PPx38079Zl5LdoC-",
          "number": "2026-000002",
          "name": "Андреева Е. П.",
          "role": "athlete",
          "team": null,
          "place": null
        },
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ]
}
```

### `GET /contests/{contest_id}/documents/{kind}/pdf`

**Все документы вида одним PDF**. Отдаёт все документы соревнования данного вида одним PDF-файлом.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |

Ответ `200`: файл или редирект.

### `GET /documents/{token}`

**Проверка документа**. Проверяет подлинность документа по токену и отдаёт его данные.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `token` | путь | string | да |  | длина ≤ 32 |

Ответ `200` — реальный ответ демо-стенда на `GET /documents/PDsUXSh1Cl3Ijd24`:

```json
{
  "valid": true,
  "token": "PDsUXSh1Cl3Ijd24",
  "number": "2026-000013",
  "kind": "diploma",
  "kind_title": "Дипломы призёров",
  "title": "Диплом",
  "lead": "награждается",
  "text": "за высокие результаты",
  "issued_on": "2026-07-03",
  "signer_position": "Председатель регионального отделения ФСП",
  "signer_name": "О. В. Федеральцев",
  "recipient": "Соколов А. И.",
  "role": "athlete",
  "team": null,
  "…": "ещё 5 полей"
}
```

### `GET /documents/{token}/pdf`

**PDF документа**. Отдаёт PDF одного документа по токену.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `token` | путь | string | да |  | длина ≤ 32 |

Ответ `200`: файл или редирект.

### `GET /me/documents`

**Мои документы (sort=new|old по дате выдачи, kind) и соревнования, по которым можно получить справку**. Отдаёт документы текущего пользователя и соревнования, по которым можно получить справку.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `sort` | query | string | нет | `new` | значения: `new`, `old` |
| `kind` | query | string | нет |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |

Ответ `200` — реальный ответ демо-стенда на `GET /me/documents`:

```json
{
  "items": [
    {
      "token": "PDsUXSh1Cl3Ijd24",
      "number": "2026-000013",
      "kind": "diploma",
      "kind_title": "Дипломы призёров",
      "title": "Диплом",
      "role": "athlete",
      "place": 1,
      "issued_on": "2026-07-03",
      "contest": {
        "id": 7,
        "title": "Чемпионат Оренбургской области по алгоритмическому программированию",
        "dates": "30.06.2026"
      }
    },
    "…ещё элементы"
  ],
  "available": [
    {
      "contest": {
        "id": 11,
        "title": "Открытый турнир ОГУ по алгоритмическому программированию",
        "dates": "14.08.2026"
      }
    },
    "…ещё элементы"
  ]
}
```

### `POST /me/documents/reference`

**Получить справку об участии**. Выдаёт текущему пользователю справку об участии в соревновании.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `contest_id` | integer | да | ≥ 1 |

```json
{
  "contest_id": 1
}
```

Ответ `200`:

```json
[
  {
    "token": "строка",
    "number": "строка",
    "kind": "certificate",
    "kind_title": "строка",
    "title": "строка",
    "role": "athlete",
    "place": 1,
    "issued_on": "2026-11-15",
    "contest": {
      "id": 1,
      "title": "строка",
      "dates": "строка"
    }
  }
]
```

### `PUT /organizer/contests/{contest_id}/documents/{kind}`

**Выпустить документы вида (заменяет прежние)**. Выпускает документы вида kind для соревнования, заменяя прежние.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 1; длина ≤ 40 |
| `lead` | string или null | нет | длина ≤ 200 |
| `text` | string или null | нет | длина ≤ 400 |
| `recipients` | string | нет | значения: `participants`, `winners` |
| `places_to` | integer | нет | ≥ 1; ≤ 100 |
| `signer_position` | string или null | нет | длина ≤ 200 |
| `signer_name` | string или null | нет | длина ≤ 100 |
| `issued_on` | string или null | нет |  |
| `judge_ids` | array или null | нет |  |

```json
{
  "title": "строка",
  "lead": "строка",
  "text": "строка",
  "recipients": "participants",
  "places_to": 3,
  "signer_position": "строка",
  "signer_name": "строка",
  "issued_on": "2026-11-15",
  "judge_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "kind": "certificate",
      "kind_title": "строка",
      "form": {
        "title": "строка",
        "lead": "строка",
        "text": "строка",
        "recipients": "participants",
        "places_to": 1,
        "signer_position": "строка",
        "signer_name": "строка",
        "issued_on": "2026-11-15"
      },
      "items": [
        {
          "token": "строка",
          "number": "строка",
          "name": "строка",
          "role": "athlete",
          "team": "строка",
          "place": 1
        }
      ]
    }
  ]
}
```

### `DELETE /organizer/contests/{contest_id}/documents/{kind}`

**Убрать документы вида**. Убирает документы вида kind у соревнования.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |

Ответ `204` — без тела.

### `GET /organizer/contests/{contest_id}/documents/{kind}/preview`

**Предпросмотр первой страницы**. Строит предпросмотр первой страницы документа без сохранения.

- Доступ: организатор (своё соревнование); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |
| `title` | query | string | да |  | длина ≤ 40 |
| `lead` | query | string | нет |  | длина ≤ 200 |
| `text` | query | string | нет |  | длина ≤ 400 |
| `recipients` | query | string | нет | `participants` | значения: `participants`, `winners` |
| `places_to` | query | integer | нет | `3` | ≥ 1, ≤ 100 |
| `signer_position` | query | string | нет |  | длина ≤ 200 |
| `signer_name` | query | string | нет |  | длина ≤ 100 |
| `issued_on` | query | string | нет |  |  |
| `judge_ids` | query | array | нет |  |  |

Ответ `200`: файл или редирект.

### `PUT /admin/contests/{contest_id}/documents/{kind}`

**Выпустить документы вида (заменяет прежние)**. Выпускает документы вида kind для соревнования, заменяя прежние.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 1; длина ≤ 40 |
| `lead` | string или null | нет | длина ≤ 200 |
| `text` | string или null | нет | длина ≤ 400 |
| `recipients` | string | нет | значения: `participants`, `winners` |
| `places_to` | integer | нет | ≥ 1; ≤ 100 |
| `signer_position` | string или null | нет | длина ≤ 200 |
| `signer_name` | string или null | нет | длина ≤ 100 |
| `issued_on` | string или null | нет |  |
| `judge_ids` | array или null | нет |  |

```json
{
  "title": "строка",
  "lead": "строка",
  "text": "строка",
  "recipients": "participants",
  "places_to": 3,
  "signer_position": "строка",
  "signer_name": "строка",
  "issued_on": "2026-11-15",
  "judge_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "kind": "certificate",
      "kind_title": "строка",
      "form": {
        "title": "строка",
        "lead": "строка",
        "text": "строка",
        "recipients": "participants",
        "places_to": 1,
        "signer_position": "строка",
        "signer_name": "строка",
        "issued_on": "2026-11-15"
      },
      "items": [
        {
          "token": "строка",
          "number": "строка",
          "name": "строка",
          "role": "athlete",
          "team": "строка",
          "place": 1
        }
      ]
    }
  ]
}
```

### `DELETE /admin/contests/{contest_id}/documents/{kind}`

**Убрать документы вида**. Убирает документы вида kind у соревнования.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |

Ответ `204` — без тела.

### `GET /admin/contests/{contest_id}/documents/{kind}/preview`

**Предпросмотр первой страницы**. Строит предпросмотр первой страницы документа без сохранения.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `kind` | путь | string | да |  | значения: `certificate`, `diploma`, `gramota`, `thanks`, `judge_thanks`, `reference`, `judge_panel` |
| `title` | query | string | да |  | длина ≤ 40 |
| `lead` | query | string | нет |  | длина ≤ 200 |
| `text` | query | string | нет |  | длина ≤ 400 |
| `recipients` | query | string | нет | `participants` | значения: `participants`, `winners` |
| `places_to` | query | integer | нет | `3` | ≥ 1, ≤ 100 |
| `signer_position` | query | string | нет |  | длина ≤ 200 |
| `signer_name` | query | string | нет |  | длина ≤ 100 |
| `issued_on` | query | string | нет |  |  |
| `judge_ids` | query | array | нет |  |  |

Ответ `200`: файл или редирект.

### `GET /people/{user_id}/report`

**Можно ли скачать отчёт и период по умолчанию**. Возвращает, доступен ли отчёт текущему пользователю, и период по умолчанию.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /people/bc167364-0988-4783-8e6c-5fb9d55162e8/report`:

```json
{
  "allowed": true,
  "date_from": "2025-10-28",
  "date_to": "2026-10-28"
}
```

### `GET /people/{user_id}/report.pdf`

**Отчёт по человеку, PDF**. Отдаёт отчёт по человеку в формате PDF.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |
| `from` | query | string | нет |  |  |
| `to` | query | string | нет |  |  |

Ответ `200`: файл или редирект.

### `GET /people/{user_id}/report.xlsx`

**Отчёт по человеку, xlsx**. Отдаёт отчёт по человеку в формате xlsx.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |
| `from` | query | string | нет |  |  |
| `to` | query | string | нет |  |  |

Ответ `200`: файл или редирект.

## Судьи, разряды и ЕВСК

### `GET /me/qualifications`

**Мои разряды и категории, а также поданные мной за спортсменов**. Отдаёт разряды и категории текущего пользователя и то, что он подавал за других.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/qualifications`:

```json
{
  "items": [
    {
      "id": "48b789fb-003f-494d-a863-96ef9f88393f",
      "kind": "rank",
      "kind_title": "Спортивный разряд",
      "item_id": 5,
      "item_name": "Первый спортивный разряд",
      "status": "pending",
      "status_title": "На рассмотрении",
      "user": {
        "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
        "name": "Соколов Артём Игоревич",
        "birth_date": "2006-03-01"
      },
      "submitted_by": {
        "id": "bc167364-0988-4783-8e6c-5fb9d55162e8",
        "name": "Соколов Артём Игоревич",
        "birth_date": "2006-03-01"
      },
      "document_file_id": "84fff5b1-0abc-45bd-bf7e-1e4fe1c279c1",
      "document_name": "athlete-2.pdf",
      "basis": "Протокол соревнования",
      "reject_reason": null,
      "valid_from": null,
      "…": "ещё 7 полей"
    },
    "…ещё элементы"
  ],
  "submitted": []
}
```

### `GET /me/athletes`

**Спортсмены из заявок тренера**. Отдаёт спортсменов из заявок текущего тренера.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/athletes`:

```json
[
  {
    "id": "432b7982-ec12-4beb-a5e0-bae0e020feb3",
    "name": "Андреева Екатерина Павловна",
    "birth_date": "2005-10-03"
  },
  "…ещё элементы"
]
```

### `POST /qualifications`

**Подать заявку на разряд или категорию**. Подаёт заявку на разряд или категорию.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `kind` | string | да | значения: `judge_category`, `rank` |
| `user_id` | string или null | нет |  |
| `item_id` | integer | да | ≥ 1 |
| `document_file_id` | string | да |  |
| `basis` | string или null | нет | длина ≤ 500 |
| `contest_result_id` | integer или null | нет | ≥ 1 |

```json
{
  "kind": "judge_category",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "item_id": 1,
  "document_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "basis": "строка",
  "contest_result_id": 1
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "kind": "judge_category",
  "kind_title": "строка",
  "item_id": 1,
  "item_name": "строка",
  "status": "pending",
  "status_title": "строка",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "document_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "document_name": "строка",
  "basis": "строка",
  "reject_reason": "строка",
  "valid_from": "2026-11-15",
  "…": "ещё 7 полей"
}
```

### `GET /me/qualification-results`

**Места из истории выступлений для основания разряда**. Возвращает места из протоколов, которые можно указать основанием разряда.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | query | string | нет |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /me/qualification-results`:

```json
[
  {
    "id": 1,
    "contest_title": "Чемпионат Оренбургской области по алгоритмическому программированию",
    "starts_on": "2026-06-30",
    "place": 1,
    "points": 40
  },
  "…ещё элементы"
]
```

### `GET /verify/qualifications/{token}`

**Проверка разряда или категории по QR**. Публичная проверка разряда или категории по QR-токену.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `token` | путь | string | да |  | длина ≤ 32 |

Ответ `200`:

```json
{
  "valid": true,
  "kind_title": "строка",
  "item_name": "строка",
  "person": "строка",
  "status": "строка",
  "valid_from": "2026-11-15",
  "valid_until": "2026-11-15",
  "order_number": "строка",
  "order_date": "2026-11-15"
}
```

### `POST /qualifications/{qualification_id}/withdraw`

**Отозвать заявку**. Отзывает заявку на разряд или категорию.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `qualification_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "kind": "judge_category",
  "kind_title": "строка",
  "item_id": 1,
  "item_name": "строка",
  "status": "pending",
  "status_title": "строка",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "document_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "document_name": "строка",
  "basis": "строка",
  "reject_reason": "строка",
  "valid_from": "2026-11-15",
  "…": "ещё 7 полей"
}
```

### `GET /admin/qualifications`

**Очередь и история заявок**. Отдаёт заявки на рассмотрение или историю, по виду и статусу.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `kind` | query | string | нет |  | значения: `judge_category`, `rank` |
| `status` | query | string | нет | `pending` | значения: `pending`, `approved`, `rejected`, `withdrawn`, `superseded` |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/qualifications`:

```json
[
  {
    "id": "042f14be-4ee4-4776-a6e8-47e6ada06d84",
    "kind": "judge_category",
    "kind_title": "Судейская категория",
    "item_id": 1,
    "item_name": "Спортивный судья всероссийской категории",
    "status": "pending",
    "status_title": "На рассмотрении",
    "user": {
      "id": "92b1ccce-9cec-4cca-83af-bcad1f7cdfa7",
      "name": "Зайцева Ольга Михайловна",
      "birth_date": "1979-10-05"
    },
    "submitted_by": {
      "id": "92b1ccce-9cec-4cca-83af-bcad1f7cdfa7",
      "name": "Зайцева Ольга Михайловна",
      "birth_date": "1979-10-05"
    },
    "document_file_id": "a6987711-dfb5-44e5-80b6-ec2f6dd6c32b",
    "document_name": "coach.judge-2.pdf",
    "basis": "Протокол соревнования",
    "reject_reason": null,
    "valid_from": null,
    "…": "ещё 7 полей"
  },
  "…ещё элементы"
]
```

### `GET /admin/qualifications/{qualification_id}/preview`

**Срок действия, если одобрить сегодня**. Показывает срок действия разряда или категории, если одобрить заявку сегодня.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `qualification_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "valid_until": "2026-11-15"
}
```

### `POST /admin/qualifications/{qualification_id}/approve`

**Присвоить**. Одобряет заявку на разряд или категорию с номером и датой приказа.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `qualification_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `order_number` | string | да | длина ≥ 1; длина ≤ 100 |
| `order_date` | string | да |  |

```json
{
  "order_number": "строка",
  "order_date": "2026-11-15"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "kind": "judge_category",
  "kind_title": "строка",
  "item_id": 1,
  "item_name": "строка",
  "status": "pending",
  "status_title": "строка",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "document_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "document_name": "строка",
  "basis": "строка",
  "reject_reason": "строка",
  "valid_from": "2026-11-15",
  "…": "ещё 7 полей"
}
```

### `POST /admin/qualifications/{qualification_id}/reject`

**Отказать с причиной**. Отклоняет заявку на разряд или категорию с причиной.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `qualification_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `reason` | string | да | длина ≥ 3; длина ≤ 500 |

```json
{
  "reason": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "kind": "judge_category",
  "kind_title": "строка",
  "item_id": 1,
  "item_name": "строка",
  "status": "pending",
  "status_title": "строка",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "submitted_by": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка",
    "birth_date": "2026-11-15"
  },
  "document_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "document_name": "строка",
  "basis": "строка",
  "reject_reason": "строка",
  "valid_from": "2026-11-15",
  "…": "ещё 7 полей"
}
```

### `GET /contests/{contest_id}/judges`

**Судейская коллегия соревнования**. Отдаёт судейскую коллегию соревнования.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/judges`:

```json
{
  "contest_id": 7,
  "starts_on": "2026-06-30",
  "items": [
    {
      "id": "3b9b90b2-593a-4dc4-b2a9-7af76abbcaf5",
      "judge": {
        "id": "e780aa12-1f03-4072-ac80-2bbe76bf9d14",
        "name": "Орлов Павел Дмитриевич",
        "birth_date": "1983-06-09"
      },
      "position": {
        "id": 1,
        "name": "Главный судья"
      },
      "category": {
        "name": "Спортивный судья второй категории",
        "valid_until": "2026-11-02"
      },
      "conflicts": []
    }
  ]
}
```

### `POST /contests/{contest_id}/judges`

**Назначить судью**. Назначает судью в коллегию соревнования и отдаёт обновлённую коллегию.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `judge_id` | string | да |  |
| `position_id` | integer | да | ≥ 1 |

```json
{
  "judge_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "position_id": 1
}
```

Ответ `201`:

```json
{
  "contest_id": 1,
  "starts_on": "2026-11-15",
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "judge": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "position": {
        "id": 1,
        "name": "строка"
      },
      "category": {
        "name": "строка",
        "valid_until": "2026-11-15"
      },
      "conflicts": []
    }
  ]
}
```

### `GET /contests/{contest_id}/judges/candidates`

**Судьи для назначения**. Подбирает судей для назначения в коллегию соревнования.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `q` | query | string | нет |  | длина ≤ 100 |

Ответ `200`:

```json
[
  {
    "judge": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "birth_date": "2026-11-15"
    },
    "category": {
      "name": "строка",
      "valid_until": "2026-11-15"
    },
    "conflicts": []
  }
]
```

### `PATCH /contests/{contest_id}/judges/{assignment_id}`

**Сменить должность**. Меняет должность судьи в коллегии и отдаёт обновлённую коллегию.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `assignment_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `position_id` | integer | да | ≥ 1 |

```json
{
  "position_id": 1
}
```

Ответ `200`:

```json
{
  "contest_id": 1,
  "starts_on": "2026-11-15",
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "judge": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "position": {
        "id": 1,
        "name": "строка"
      },
      "category": {
        "name": "строка",
        "valid_until": "2026-11-15"
      },
      "conflicts": []
    }
  ]
}
```

### `DELETE /contests/{contest_id}/judges/{assignment_id}`

**Снять судью**. Снимает судью с коллегии и отдаёт обновлённую коллегию.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |
| `assignment_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "contest_id": 1,
  "starts_on": "2026-11-15",
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "judge": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "строка",
        "birth_date": "2026-11-15"
      },
      "position": {
        "id": 1,
        "name": "строка"
      },
      "category": {
        "name": "строка",
        "valid_until": "2026-11-15"
      },
      "conflicts": []
    }
  ]
}
```

### `GET /me/judge-assignments`

**Мои назначения судьёй**. Отдаёт назначения текущего пользователя судьёй.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/judge-assignments`:

```json
[
  {
    "id": "15ca2590-4511-406a-8282-3b010a621517",
    "contest": {
      "id": 33,
      "title": "Первенство Оренбуржья по продуктовому программированию, этап 18",
      "starts_on": "2026-09-04",
      "ends_on": "2026-09-06",
      "status": "completed"
    },
    "position": {
      "id": 3,
      "name": "Главный секретарь"
    }
  },
  "…ещё элементы"
]
```

### `GET /contests/{contest_id}/judge-documents`

**Документы судейской коллегии**. Возвращает документы судейской коллегии соревнования.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/judge-documents`:

```json
[
  {
    "id": "9a48921b-bff3-4bbf-9a04-7c5b3905d7fb",
    "kind": "protocol",
    "kind_title": "Протокол судьи",
    "judge_id": "92b1ccce-9cec-4cca-83af-bcad1f7cdfa7",
    "judge_name": "Зайцева Ольга Михайловна",
    "position": "Главный секретарь",
    "removed": true,
    "file_name": "protokol-sekretarya.pdf",
    "file_type": "application/pdf",
    "file_size": 25956,
    "url": "http://localhost:9100/fsp-public/judge_documents/protokol-sekretarya.pdf",
    "comment": null,
    "created_at": "2026-10-28T14:21:27.848354Z",
    "updated_at": "2026-10-28T14:21:27.848354Z"
  },
  "…ещё элементы"
]
```

### `POST /contests/{contest_id}/judge-documents`

**Загрузить документ судьи**. Загружает документ судьи к протоколу соревнования.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `kind` | string | да | значения: `note`, `act`, `protocol`, `other` |
| `file_id` | string | да |  |
| `comment` | string или null | нет | длина ≤ 500 |

```json
{
  "kind": "note",
  "file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "comment": "строка"
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "kind": "note",
  "kind_title": "строка",
  "judge_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "judge_name": "строка",
  "position": "строка",
  "removed": true,
  "file_name": "строка",
  "file_type": "строка",
  "file_size": 1,
  "url": "строка",
  "comment": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `PATCH /judge-documents/{document_id}`

**Заменить свой документ**. Заменяет свой документ судьи.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `document_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `kind` | string | да | значения: `note`, `act`, `protocol`, `other` |
| `file_id` | string или null | нет |  |
| `comment` | string или null | нет | длина ≤ 500 |

```json
{
  "kind": "note",
  "file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "comment": "строка"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "kind": "note",
  "kind_title": "строка",
  "judge_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "judge_name": "строка",
  "position": "строка",
  "removed": true,
  "file_name": "строка",
  "file_type": "строка",
  "file_size": 1,
  "url": "строка",
  "comment": "строка",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00"
}
```

### `DELETE /judge-documents/{document_id}`

**Удалить свой документ**. Удаляет свой документ судьи.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `document_id` | путь | string | да |  |  |

Ответ `204` — без тела.

### `GET /admin/evsk/rules`

**Правила ЕВСК: место → разряд**. Возвращает правила ЕВСК.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/evsk/rules`:

```json
[
  {
    "id": 1,
    "rank_type": {
      "id": 4,
      "name": "Кандидат в мастера спорта"
    },
    "contest_level": {
      "id": 3,
      "name": "Всероссийское"
    },
    "discipline": null,
    "place_to": 3,
    "min_participants": 10,
    "min_age": null,
    "max_age": null,
    "source": "Демо-значения до внесения норм ЕВСК ФСП России",
    "is_demo": true,
    "note": null
  },
  "…ещё элементы"
]
```

### `POST /admin/evsk/rules`

**Добавить правило**. Создаёт правило ЕВСК.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `rank_type_id` | integer | да | ≥ 1 |
| `contest_level_id` | integer | да | ≥ 1 |
| `discipline_id` | integer или null | нет | ≥ 1 |
| `place_to` | integer | да | ≥ 1; ≤ 100 |
| `min_participants` | integer | нет | ≥ 0; ≤ 10000 |
| `min_age` | integer или null | нет | ≥ 5; ≤ 100 |
| `max_age` | integer или null | нет | ≥ 5; ≤ 100 |
| `source` | string или null | нет | длина ≤ 300 |
| `is_demo` | boolean | нет |  |
| `note` | string или null | нет | длина ≤ 1000 |

```json
{
  "rank_type_id": 1,
  "contest_level_id": 1,
  "discipline_id": 1,
  "place_to": 1,
  "min_participants": 0,
  "min_age": 1,
  "max_age": 1,
  "source": "строка",
  "is_demo": false,
  "note": "строка"
}
```

Ответ `201`:

```json
{
  "id": 1,
  "rank_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "place_to": 1,
  "min_participants": 1,
  "min_age": 1,
  "max_age": 1,
  "source": "строка",
  "is_demo": true,
  "note": "строка"
}
```

### `PATCH /admin/evsk/rules/{rule_id}`

**Изменить правило**. Правит правило ЕВСК.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `rule_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `rank_type_id` | integer | да | ≥ 1 |
| `contest_level_id` | integer | да | ≥ 1 |
| `discipline_id` | integer или null | нет | ≥ 1 |
| `place_to` | integer | да | ≥ 1; ≤ 100 |
| `min_participants` | integer | нет | ≥ 0; ≤ 10000 |
| `min_age` | integer или null | нет | ≥ 5; ≤ 100 |
| `max_age` | integer или null | нет | ≥ 5; ≤ 100 |
| `source` | string или null | нет | длина ≤ 300 |
| `is_demo` | boolean | нет |  |
| `note` | string или null | нет | длина ≤ 1000 |

```json
{
  "rank_type_id": 1,
  "contest_level_id": 1,
  "discipline_id": 1,
  "place_to": 1,
  "min_participants": 0,
  "min_age": 1,
  "max_age": 1,
  "source": "строка",
  "is_demo": false,
  "note": "строка"
}
```

Ответ `200`:

```json
{
  "id": 1,
  "rank_type": {
    "id": 1,
    "name": "строка"
  },
  "contest_level": {
    "id": 1,
    "name": "строка"
  },
  "discipline": {
    "id": 1,
    "name": "строка"
  },
  "place_to": 1,
  "min_participants": 1,
  "min_age": 1,
  "max_age": 1,
  "source": "строка",
  "is_demo": true,
  "note": "строка"
}
```

### `DELETE /admin/evsk/rules/{rule_id}`

**Удалить правило**. Удаляет правило ЕВСК.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `rule_id` | путь | integer | да |  |  |

Ответ `204` — без тела.

### `GET /admin/evsk/candidates`

**Кто может претендовать на разряд по протоколам за год**. Возвращает претендентов на разряд по соревнованиям за год.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/evsk/candidates`:

```json
[
  {
    "user_id": "4b2175cb-5774-4c67-9367-84f682013225",
    "name": "Петров Тимофей Олегович",
    "contest_id": 10,
    "contest_title": "Турнир юных программистов «Первый код»",
    "ends_on": "2026-09-28",
    "place": 1,
    "result_id": 37,
    "rank": "Первый юношеский спортивный разряд",
    "rank_type_id": 8,
    "rule_demo": true,
    "current": "Третий юношеский спортивный разряд"
  },
  "…ещё элементы"
]
```

### `GET /contests/{contest_id}/evsk`

**Подсветка ЕВСК по протоколу соревнования**. Возвращает претендентов на разряд по местам соревнования.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/evsk`:

```json
[
  {
    "user_id": "8d79e4a3-24e5-4bab-b0a8-ec73231fa69c",
    "name": "Макаров Владислав Андреевич",
    "contest_id": 7,
    "contest_title": "Чемпионат Оренбургской области по алгоритмическому программированию",
    "ends_on": "2026-06-30",
    "place": 2,
    "result_id": 2,
    "rank": "Второй спортивный разряд",
    "rank_type_id": 6,
    "rule_demo": true,
    "current": null
  },
  "…ещё элементы"
]
```

### `GET /me/path`

**Личный путь: текущий разряд, что нужно для следующего, подходящие соревнования**. Возвращает личный путь текущего спортсмена к следующему разряду.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/path`:

```json
{
  "current": "Второй спортивный разряд",
  "current_valid_until": "2027-09-23",
  "next": {
    "rank": {
      "id": 5,
      "name": "Первый спортивный разряд"
    },
    "rules": [
      {
        "id": 3,
        "rank_type": {
          "id": 5,
          "name": "Первый спортивный разряд"
        },
        "contest_level": {
          "id": 2,
          "name": "Межрегиональное"
        },
        "discipline": null,
        "place_to": 3,
        "min_participants": 8,
        "min_age": null,
        "max_age": null,
        "source": "Демо-значения до внесения норм ЕВСК ФСП России",
        "is_demo": true,
        "note": null
      },
      "…ещё элементы"
    ]
  },
  "later": [
    {
      "id": 4,
      "name": "Кандидат в мастера спорта"
    },
    "…ещё элементы"
  ],
  "contests": [],
  "achieved": []
}
```

## Апелляции и нарушения

### `GET /contests/{contest_id}/disputes`

**Апелляции и нарушения соревнования**. Возвращает апелляции и нарушения в пределах прав, свои заявки для апелляции и участников для рапорта.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /contests/7/disputes`:

```json
{
  "privileged": false,
  "can_report": false,
  "appeal_until": "2026-07-30",
  "appeals": [],
  "violations": [],
  "entries": [
    {
      "application_id": 1,
      "title": "Соколов Артём",
      "place": 1
    }
  ],
  "participants": []
}
```

### `POST /contests/{contest_id}/appeals`

**Подать апелляцию на результат**. Участник, автор заявки или тренер участника подаёт апелляцию на место с доказательствами.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `application_id` | integer | да | ≥ 1 |
| `requested_place` | integer или null | нет | ≥ 1 |
| `reason` | string | да | длина ≤ 4000 |
| `evidence_url` | string или null | нет | длина ≤ 500; формат `^https?://` |
| `file_ids` | array | нет | элементов ≤ 10 |

```json
{
  "application_id": 1,
  "requested_place": 1,
  "reason": "строка",
  "evidence_url": "строка",
  "file_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest": {
    "id": 1,
    "title": "строка",
    "ends_on": "2026-11-15"
  },
  "application_id": 1,
  "entry": "строка",
  "filer": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "current_place": 1,
  "requested_place": 1,
  "reason": "строка",
  "evidence_url": "строка",
  "files": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "url": "строка"
    }
  ],
  "status": "submitted",
  "status_title": "строка",
  "decision": "строка",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "…": "ещё 1 полей"
}
```

### `POST /appeals/{appeal_id}/withdraw`

**Отозвать свою апелляцию**. Отзывает свою апелляцию, пока нет решения.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `appeal_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest": {
    "id": 1,
    "title": "строка",
    "ends_on": "2026-11-15"
  },
  "application_id": 1,
  "entry": "строка",
  "filer": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "current_place": 1,
  "requested_place": 1,
  "reason": "строка",
  "evidence_url": "строка",
  "files": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "url": "строка"
    }
  ],
  "status": "submitted",
  "status_title": "строка",
  "decision": "строка",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "…": "ещё 1 полей"
}
```

### `POST /contests/{contest_id}/violations`

**Рапорт о нарушении**. Судья коллегии или федерация сообщает о нарушении участника.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `contest_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `user_id` | string | да |  |
| `description` | string | да | длина ≤ 4000 |
| `evidence_url` | string или null | нет | длина ≤ 500; формат `^https?://` |
| `file_ids` | array | нет | элементов ≤ 10 |

```json
{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "description": "строка",
  "evidence_url": "строка",
  "file_ids": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest": {
    "id": 1,
    "title": "строка",
    "ends_on": "2026-11-15"
  },
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "reporter": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "description": "строка",
  "evidence_url": "строка",
  "files": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "url": "строка"
    }
  ],
  "status": "reported",
  "status_title": "строка",
  "sanction": "warning",
  "sanction_title": "строка",
  "suspended_until": "2026-11-15",
  "decision": "строка",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "…": "ещё 1 полей"
}
```

### `GET /me/appealable`

**Где можно подать апелляцию сейчас**. Соревнования с внесёнными местами и открытым сроком, где человек участник, автор заявки или тренер участника.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/appealable`:

```json
{
  "items": []
}
```

### `GET /me/disputes`

**Мои апелляции и решения по нарушениям**. Возвращает апелляции по своим заявкам и решения по нарушениям о себе.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/disputes`:

```json
{
  "appeals": [],
  "violations": []
}
```

### `GET /admin/disputes`

**Очередь апелляций и нарушений**. Возвращает апелляции и рапорты; по умолчанию только ждущие решения.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `include_closed` | query | boolean | нет | `False` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/disputes`:

```json
{
  "appeals": [
    {
      "id": "3b8f8e59-d1c7-4cc8-b7e7-336304adf18c",
      "contest": {
        "id": 12,
        "title": "Внутренний турнир лицея № 1 по алгоритмике",
        "ends_on": "2026-10-08"
      },
      "application_id": 46,
      "entry": "Тарасова Вероника",
      "filer": {
        "id": "6af42937-540d-46d9-b3b9-7617d23b41ac",
        "name": "Тарасова Вероника Олеговна"
      },
      "current_place": 3,
      "requested_place": 2,
      "reason": "Задача D засчитана после перепроверки, но в протокол попало первоначальное значение. Лог проверяющей системы прилагаю.",
      "evidence_url": null,
      "files": [
        {
          "id": "0d6e44cb-a588-4cf4-bed7-1c5048e76faf",
          "name": "appeal-lyceum-log.pdf",
          "url": "/api/v1/files/0d6e44cb-a588-4cf4-bed7-1c5048e76faf"
        }
      ],
      "status": "submitted",
      "status_title": "Подана",
      "decision": null,
      "decided_at": null,
      "…": "ещё 1 полей"
    },
    "…ещё элементы"
  ],
  "violations": [
    {
      "id": "d8efff5d-ecac-4406-ad5c-2631d2ae16e0",
      "contest": {
        "id": 14,
        "title": "Олимпиада школьников по искусственному интеллекту",
        "ends_on": "2026-07-30"
      },
      "athlete": {
        "id": "6af42937-540d-46d9-b3b9-7617d23b41ac",
        "name": "Тарасова Вероника Олеговна"
      },
      "reporter": {
        "id": "e780aa12-1f03-4072-ac80-2bbe76bf9d14",
        "name": "Орлов Павел Дмитриевич"
      },
      "description": "Во втором туре у участника открыт сторонний чат на втором мониторе. Снимок экрана наблюдателя прилагаю.",
      "evidence_url": null,
      "files": [
        {
          "id": "857cacf9-a161-499c-910a-b291df0b27de",
          "name": "violation-ai-olympiad.pdf",
          "url": "/api/v1/files/857cacf9-a161-499c-910a-b291df0b27de"
        }
      ],
      "status": "reported",
      "status_title": "Ждёт решения",
      "sanction": null,
      "sanction_title": null,
      "suspended_until": null,
      "decision": null,
      "decided_at": null,
      "…": "ещё 1 полей"
    }
  ]
}
```

### `POST /admin/appeals/{appeal_id}/review`

**Взять апелляцию на рассмотрение**. Переводит апелляцию в «на рассмотрении» и уведомляет участников.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `appeal_id` | путь | string | да |  |  |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest": {
    "id": 1,
    "title": "строка",
    "ends_on": "2026-11-15"
  },
  "application_id": 1,
  "entry": "строка",
  "filer": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "current_place": 1,
  "requested_place": 1,
  "reason": "строка",
  "evidence_url": "строка",
  "files": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "url": "строка"
    }
  ],
  "status": "submitted",
  "status_title": "строка",
  "decision": "строка",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "…": "ещё 1 полей"
}
```

### `POST /admin/appeals/{appeal_id}/decide`

**Решение по апелляции**. Удовлетворяет апелляцию с правкой мест или отклоняет её с обоснованием.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `appeal_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `upheld` | boolean | да |  |
| `decision` | string | да | длина ≤ 4000 |
| `places` | array | нет | элементов ≤ 500 |

```json
{
  "upheld": true,
  "decision": "строка",
  "places": [
    {
      "application_id": 1,
      "place": 1
    }
  ]
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest": {
    "id": 1,
    "title": "строка",
    "ends_on": "2026-11-15"
  },
  "application_id": 1,
  "entry": "строка",
  "filer": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "current_place": 1,
  "requested_place": 1,
  "reason": "строка",
  "evidence_url": "строка",
  "files": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "url": "строка"
    }
  ],
  "status": "submitted",
  "status_title": "строка",
  "decision": "строка",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "…": "ещё 1 полей"
}
```

### `POST /admin/violations/{violation_id}/decide`

**Решение по нарушению**. Применяет санкцию или закрывает рапорт без санкции.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `violation_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `sanction` | string или null | нет | значения: `warning`, `technical_defeat`, `disqualification`, `suspension` |
| `decision` | string | да | длина ≤ 4000 |
| `suspended_until` | string или null | нет |  |

```json
{
  "sanction": "warning",
  "decision": "строка",
  "suspended_until": "2026-11-15"
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "contest": {
    "id": 1,
    "title": "строка",
    "ends_on": "2026-11-15"
  },
  "athlete": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "reporter": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "строка"
  },
  "description": "строка",
  "evidence_url": "строка",
  "files": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "строка",
      "url": "строка"
    }
  ],
  "status": "reported",
  "status_title": "строка",
  "sanction": "warning",
  "sanction_title": "строка",
  "suspended_until": "2026-11-15",
  "decision": "строка",
  "decided_at": "2026-11-15T12:00:00+05:00",
  "…": "ещё 1 полей"
}
```

## Сроки

### `GET /me/deadlines`

**Мои сроки на 60 дней вперёд**. Возвращает сроки текущего пользователя по всем его ролям.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/deadlines`:

```json
[
  {
    "kind": "registration",
    "title": "Открытый турнир по информационной безопасности (CTF)",
    "detail": "Закрытие приёма заявок",
    "due": "2026-11-10",
    "days_left": 13,
    "link": "/competitions/3"
  },
  "…ещё элементы"
]
```

### `GET /admin/report-deadlines`

**Отчётные сроки федерации**. Возвращает отчётные сроки федерации.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `include_done` | query | boolean | нет | `False` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/report-deadlines`:

```json
[
  {
    "id": 2,
    "title": "Сведения о проведённых соревнованиях за полугодие",
    "description": null,
    "recipient": "Министерство спорта Оренбургской области",
    "due_on": "2026-11-02",
    "done_at": null,
    "days_left": 5
  },
  "…ещё элементы"
]
```

### `POST /admin/report-deadlines`

**Добавить отчётный срок**. Создаёт отчётный срок.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 2; длина ≤ 300 |
| `due_on` | string | да |  |
| `description` | string или null | нет | длина ≤ 2000 |
| `recipient` | string или null | нет | длина ≤ 300 |
| `done` | boolean или null | нет |  |

```json
{
  "title": "строка",
  "due_on": "2026-11-15",
  "description": "строка",
  "recipient": "строка",
  "done": true
}
```

Ответ `201`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "recipient": "строка",
  "due_on": "2026-11-15",
  "done_at": "2026-11-15T12:00:00+05:00",
  "days_left": 1
}
```

### `GET /admin/report-deadlines/governor`

**Срок ходатайств на премии Губернатора**. Возвращает срок ходатайств на премии Губернатора и сколько до него дней.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/report-deadlines/governor`:

```json
{
  "due": "2027-02-01",
  "days_left": 96
}
```

### `PATCH /admin/report-deadlines/{report_id}`

**Изменить или отметить выполненным**. Правит отчётный срок.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `report_id` | путь | integer | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 2; длина ≤ 300 |
| `due_on` | string | да |  |
| `description` | string или null | нет | длина ≤ 2000 |
| `recipient` | string или null | нет | длина ≤ 300 |
| `done` | boolean или null | нет |  |

```json
{
  "title": "строка",
  "due_on": "2026-11-15",
  "description": "строка",
  "recipient": "строка",
  "done": true
}
```

Ответ `200`:

```json
{
  "id": 1,
  "title": "строка",
  "description": "строка",
  "recipient": "строка",
  "due_on": "2026-11-15",
  "done_at": "2026-11-15T12:00:00+05:00",
  "days_left": 1
}
```

### `DELETE /admin/report-deadlines/{report_id}`

**Удалить**. Удаляет отчётный срок.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `report_id` | путь | integer | да |  |  |

Ответ `204` — без тела.

## Уведомления и Telegram

### `GET /notifications`

**Inbox**. Возвращает страницу уведомлений пользователя.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `unread_only` | query | boolean | нет | `False` |  |
| `limit` | query | integer | нет | `20` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` | ≤ 2147483647 |

Ответ `200` — реальный ответ демо-стенда на `GET /notifications`:

```json
{
  "items": [
    {
      "id": "2ff55426-55a3-431d-a444-b78079d5ae6c",
      "type": "antidoping.expiring",
      "title": "Антидопинговый курс",
      "text": "Сертификат курса РУСАДА действует до 12.11.2026. Пройдите курс заново.",
      "link": "/cabinet/athlete/profile",
      "is_read": false,
      "email_status": "pending",
      "email_sent_at": null,
      "created_at": "2026-10-28T14:21:44.764044Z"
    }
  ],
  "total": 1
}
```

### `GET /notifications/unread-count`

**Unread Count**. Возвращает количество непрочитанных уведомлений.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /notifications/unread-count`:

```json
{
  "count": 1
}
```

### `POST /notifications/read-all`

**Read All**. Отмечает все уведомления пользователя прочитанными.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `204` — без тела.

### `POST /notifications/{id}/read`

**Read One**. Отмечает одно уведомление прочитанным.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `id` | путь | string | да |  |  |

Ответ `204` — без тела.

### `GET /me/notification-settings`

**Какие уведомления куда приходят**. Возвращает настройки уведомлений пользователя.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/notification-settings`:

```json
{
  "items": [
    {
      "group": "security",
      "label": "Безопасность",
      "description": "Коды, смена пароля и почты, вход с нового устройства",
      "email": true,
      "telegram": true,
      "locked": true
    },
    "…ещё элементы"
  ]
}
```

### `PUT /me/notification-settings`

**Изменить настройки уведомлений**. Обновляет настройки уведомлений пользователя и возвращает их новый вид.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `items` | array | да | элементов ≤ 20 |

```json
{
  "items": [
    {
      "group": "security",
      "channel": "email",
      "enabled": true
    }
  ]
}
```

Ответ `200`:

```json
{
  "items": [
    {
      "group": "security",
      "label": "строка",
      "description": "строка",
      "email": true,
      "telegram": true,
      "locked": true
    }
  ]
}
```

### `GET /me/telegram`

**Привязка Telegram**. Возвращает состояние привязки Telegram пользователя.

- Доступ: вошедший пользователь; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /me/telegram`:

```json
{
  "available": true,
  "bot": "FSP_Oren_bot",
  "linked": false,
  "username": null,
  "linked_at": null,
  "mailpit_url": "http://localhost:8126"
}
```

### `DELETE /me/telegram`

**Отвязать Telegram**. Отвязывает Telegram от аккаунта пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `204` — без тела.

### `POST /me/notifications/test`

**Проверка доставки во все каналы**. Отправляет тестовое уведомление во все подключённые каналы.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `204` — без тела.

### `POST /me/telegram/link`

**Ссылка на бота для привязки**. Возвращает ссылку на бота для привязки Telegram.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Ответ `200`:

```json
{
  "url": "строка"
}
```

### `GET /admin/telegram/admins`

**Администраторы бота и права уровней**. Возвращает администраторов бота, их уровни и права по уровням.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/telegram/admins`:

```json
{
  "my_level": "owner",
  "can_manage": true,
  "levels": [
    {
      "code": "moderator",
      "label": "Модератор",
      "rights": [
        "Очередь модерации: заявки на роли, соревнования на верификации",
        "…ещё элементы"
      ]
    },
    "…ещё элементы"
  ],
  "items": [
    {
      "user_id": "672200af-4873-474f-8f77-39393c4563c0",
      "full_name": "Федеральцев Олег Викторович",
      "email": "federation@example.test",
      "level": "owner",
      "linked": false,
      "granted_by": null,
      "created_at": "2026-10-28T14:21:27.848354Z"
    },
    "…ещё элементы"
  ]
}
```

### `POST /admin/telegram/admins`

**Назначить администратора бота**. Назначает администратора бота по email.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `email` | string | да | длина ≤ 255; формат `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| `level` | string | да | значения: `moderator`, `admin`, `owner` |

```json
{
  "email": "строка",
  "level": "moderator"
}
```

Ответ `204` — без тела.

### `PATCH /admin/telegram/admins/{user_id}`

**Изменить уровень**. Меняет уровень администратора бота.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `level` | string | да | значения: `moderator`, `admin`, `owner` |

```json
{
  "level": "moderator"
}
```

Ответ `204` — без тела.

### `DELETE /admin/telegram/admins/{user_id}`

**Снять администратора**. Снимает администратора бота.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `user_id` | путь | string | да |  |  |

Ответ `204` — без тела.

## Журнал, аналитика, файлы, новости

### `GET /health`

**Health**. Проверяет доступность Postgres и Redis и возвращает общий статус.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /health`:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok"
}
```

### `GET /admin/audit`

**Записи журнала: order=desc — новые сверху, asc — старые**. Возвращает страницу записей журнала действий по фильтрам.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет |  | длина ≤ 100 |
| `user_id` | query | string | нет |  |  |
| `action` | query | string | нет |  | длина ≤ 50 |
| `object_type` | query | string | нет |  | длина ≤ 50 |
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `limit` | query | integer | нет | `20` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` | ≤ 2147483647 |
| `order` | query | string | нет | `desc` | значения: `desc`, `asc` |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/audit`:

```json
{
  "items": [
    {
      "id": "92c5655d-74f6-4401-b165-fb65a71e911b",
      "created_at": "2026-10-28T14:21:51.685604Z",
      "user": {
        "id": "e780aa12-1f03-4072-ac80-2bbe76bf9d14",
        "full_name": "Орлов Павел Дмитриевич",
        "email": "judge@example.test"
      },
      "action": "auth.login",
      "action_label": "Вход в аккаунт",
      "object_type": null,
      "object_label": null,
      "object_id": null,
      "payload": {},
      "ip": "172.17.0.1"
    },
    "…ещё элементы"
  ],
  "total": 5
}
```

### `GET /admin/audit/catalog`

**Действия и объекты для фильтров**. Возвращает справочники действий и объектов для фильтров журнала.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Ответ `200` — реальный ответ демо-стенда на `GET /admin/audit/catalog`:

```json
{
  "actions": [
    {
      "code": "auth.register",
      "label": "Регистрация аккаунта"
    },
    "…ещё элементы"
  ],
  "objects": [
    {
      "code": "user",
      "label": "Аккаунт"
    },
    "…ещё элементы"
  ]
}
```

### `POST /files`

**Загрузить файл**. Загружает файл текущего пользователя.

- Доступ: вошедший пользователь (роль — в описании); нужен заголовок `X-CSRF-Token`

Тело запроса: `multipart/form-data`, поле `file` — файл.

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "original_name": "строка",
  "content_type": "строка",
  "size": 1,
  "is_public": true,
  "url": "строка"
}
```

### `GET /files/{file_id}`

**Скачать файл**. Перенаправляет на ссылку для скачивания файла с учётом прав доступа.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `file_id` | путь | string | да |  |  |

Ответ `200`: файл или редирект.

### `GET /news`

**Лента опубликованных статей**. Возвращает страницу опубликованных статей по фильтрам.

- Доступ: без входа

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет | `` | длина ≤ 200 |
| `section` | query | string | нет |  | длина ≤ 100 |
| `tag` | query | string | нет |  | длина ≤ 50 |
| `limit` | query | integer | нет | `12` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /news`:

```json
{
  "items": [
    {
      "id": "9978e0c6-790a-42a9-8699-476f330d5024",
      "slug": "itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu",
      "title": "Итоги регионального этапа по продуктовому программированию",
      "section": "Соревнования",
      "summary": "24 команды за 48 часов собрали сервисы для городских задач. Три лучшие едут на финал в Москву.",
      "cover_file_id": null,
      "blocks": [
        {
          "text": "Региональный этап прошёл в Технопарке ОГУ. Команды решали кейсы мэрии Оренбурга и двух ИТ-компаний области.",
          "type": "text"
        },
        "…ещё элементы"
      ],
      "hashtags": [
        "продуктовое",
        "…ещё элементы"
      ],
      "published_at": "2026-10-26T14:21:27.848354Z",
      "views": 0
    },
    "…ещё элементы"
  ],
  "total": 3
}
```

### `GET /news/tags`

**Хэштеги опубликованных статей**. Возвращает хэштеги опубликованных статей с количеством упоминаний.

- Доступ: без входа

Ответ `200` — реальный ответ демо-стенда на `GET /news/tags`:

```json
[
  {
    "name": "ctf",
    "count": 1
  },
  "…ещё элементы"
]
```

### `GET /news/{slug}`

**Статья**. Возвращает опубликованную статью по slug, засчитывая просмотр по пользователю или IP.

- Доступ: без входа; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `slug` | путь | string | да |  | длина ≤ 220 |

Ответ `200` — реальный ответ демо-стенда на `GET /news/itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu`:

```json
{
  "id": "9978e0c6-790a-42a9-8699-476f330d5024",
  "slug": "itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu",
  "title": "Итоги регионального этапа по продуктовому программированию",
  "section": "Соревнования",
  "summary": "24 команды за 48 часов собрали сервисы для городских задач. Три лучшие едут на финал в Москву.",
  "cover_file_id": null,
  "blocks": [
    {
      "text": "Региональный этап прошёл в Технопарке ОГУ. Команды решали кейсы мэрии Оренбурга и двух ИТ-компаний области.",
      "type": "text"
    },
    "…ещё элементы"
  ],
  "hashtags": [
    "продуктовое",
    "…ещё элементы"
  ],
  "published_at": "2026-10-26T14:21:27.848354Z",
  "views": 3
}
```

### `GET /admin/news`

**Все статьи, включая черновики и архив**. Возвращает страницу статей для админки по фильтрам, включая черновики и архив.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `q` | query | string | нет | `` | длина ≤ 200 |
| `status` | query | string | нет |  | значения: `draft`, `published`, `archived` |
| `tag` | query | string | нет |  | длина ≤ 50 |
| `limit` | query | integer | нет | `20` | ≥ 1, ≤ 100 |
| `offset` | query | integer | нет | `0` |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/news`:

```json
{
  "items": [
    {
      "id": "9978e0c6-790a-42a9-8699-476f330d5024",
      "slug": "itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu",
      "title": "Итоги регионального этапа по продуктовому программированию",
      "section": "Соревнования",
      "summary": "24 команды за 48 часов собрали сервисы для городских задач. Три лучшие едут на финал в Москву.",
      "cover_file_id": null,
      "blocks": [
        {
          "text": "Региональный этап прошёл в Технопарке ОГУ. Команды решали кейсы мэрии Оренбурга и двух ИТ-компаний области.",
          "type": "text"
        },
        "…ещё элементы"
      ],
      "hashtags": [
        "продуктовое",
        "…ещё элементы"
      ],
      "status": "published",
      "published_at": "2026-10-26T14:21:27.848354Z",
      "created_at": "2026-10-28T14:21:27.848354Z",
      "updated_at": "2026-10-28T14:21:27.848354Z",
      "views": 2
    },
    "…ещё элементы"
  ],
  "total": 4
}
```

### `POST /admin/news`

**Создать черновик**. Создаёт новую статью-черновик.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string | да | длина ≥ 1; длина ≤ 200 |
| `section` | string или null | нет | длина ≤ 100 |
| `summary` | string или null | нет | длина ≤ 500 |
| `cover_file_id` | string или null | нет |  |
| `blocks` | array | нет | элементов ≤ 100 |
| `hashtags` | array | нет | элементов ≤ 10 |

```json
{
  "title": "строка",
  "section": "строка",
  "summary": "строка",
  "cover_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "blocks": [
    {
      "type": "строка",
      "text": "строка",
      "level": 2
    }
  ],
  "hashtags": [
    "строка"
  ]
}
```

Ответ `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "slug": "строка",
  "title": "строка",
  "section": "строка",
  "summary": "строка",
  "cover_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "blocks": [
    {}
  ],
  "hashtags": [
    "строка"
  ],
  "status": "draft",
  "published_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00",
  "views": 1
}
```

### `GET /admin/news/{article_id}`

**Статья**. Возвращает статью по id в любом статусе.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `article_id` | путь | string | да |  |  |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/news/9978e0c6-790a-42a9-8699-476f330d5024`:

```json
{
  "id": "9978e0c6-790a-42a9-8699-476f330d5024",
  "slug": "itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu",
  "title": "Итоги регионального этапа по продуктовому программированию",
  "section": "Соревнования",
  "summary": "24 команды за 48 часов собрали сервисы для городских задач. Три лучшие едут на финал в Москву.",
  "cover_file_id": null,
  "blocks": [
    {
      "text": "Региональный этап прошёл в Технопарке ОГУ. Команды решали кейсы мэрии Оренбурга и двух ИТ-компаний области.",
      "type": "text"
    },
    "…ещё элементы"
  ],
  "hashtags": [
    "продуктовое",
    "…ещё элементы"
  ],
  "status": "published",
  "published_at": "2026-10-26T14:21:27.848354Z",
  "created_at": "2026-10-28T14:21:27.848354Z",
  "updated_at": "2026-10-28T14:21:27.848354Z",
  "views": 2
}
```

### `PATCH /admin/news/{article_id}`

**Изменить статью**. Обновляет переданные поля статьи.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `article_id` | путь | string | да |  |  |

Тело запроса:

| Поле | Тип | Обязательно | Ограничения |
|---|---|---|---|
| `title` | string или null | нет | длина ≥ 1; длина ≤ 200 |
| `section` | string или null | нет | длина ≤ 100 |
| `summary` | string или null | нет | длина ≤ 500 |
| `cover_file_id` | string или null | нет |  |
| `blocks` | array или null | нет | элементов ≤ 100 |
| `hashtags` | array или null | нет | элементов ≤ 10 |

```json
{
  "title": "строка",
  "section": "строка",
  "summary": "строка",
  "cover_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "blocks": [
    {
      "type": "строка",
      "text": "строка",
      "level": 2
    }
  ],
  "hashtags": [
    "строка"
  ]
}
```

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "slug": "строка",
  "title": "строка",
  "section": "строка",
  "summary": "строка",
  "cover_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "blocks": [
    {}
  ],
  "hashtags": [
    "строка"
  ],
  "status": "draft",
  "published_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00",
  "views": 1
}
```

### `POST /admin/news/{article_id}/{action}`

**Опубликовать, снять, архивировать или восстановить**. Меняет статус статьи: публикация, снятие с публикации, архивация или восстановление.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `article_id` | путь | string | да |  |  |
| `action` | путь | string | да |  | значения: `publish`, `unpublish`, `archive`, `restore` |

Ответ `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "slug": "строка",
  "title": "строка",
  "section": "строка",
  "summary": "строка",
  "cover_file_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "blocks": [
    {}
  ],
  "hashtags": [
    "строка"
  ],
  "status": "draft",
  "published_at": "2026-11-15T12:00:00+05:00",
  "created_at": "2026-11-15T12:00:00+05:00",
  "updated_at": "2026-11-15T12:00:00+05:00",
  "views": 1
}
```

### `GET /admin/analytics.xlsx`

**Вся аналитика книгой: лист «Параметры» и по листу на блок**. Отдаёт книгу xlsx со всеми блоками аналитики, по листу на блок.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `group_kind` | query | string | нет |  | значения: `age`, `academic` |
| `group_id` | query | integer | нет |  | ≥ 1 |

Ответ `200`:

```json
null
```

### `GET /admin/analytics/{block}.xlsx`

**Один блок аналитики листом xlsx**. Отдаёт один блок аналитики xlsx-файлом.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `block` | путь | string | да |  | значения: `summary`, `participants`, `contests`, `applications`, `retention`, `demographics`, `coaches`, `judges`, `qualifications`, `disciplines` |
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `group_kind` | query | string | нет |  | значения: `age`, `academic` |
| `group_id` | query | integer | нет |  | ≥ 1 |

Ответ `200`:

```json
null
```

### `GET /admin/analytics/{block}`

**Блок аналитики: показатели за период и сравнение с прошлым**. Отдаёт один блок аналитики в JSON с данными за период и прошлый период.

- Доступ: сотрудник федерации; нужен заголовок `X-CSRF-Token`

| Параметр | Где | Тип | Обязателен | По умолчанию | Описание |
|---|---|---|---|---|---|
| `block` | путь | string | да |  | значения: `summary`, `participants`, `contests`, `applications`, `retention`, `demographics`, `coaches`, `judges`, `qualifications`, `disciplines` |
| `date_from` | query | string | нет |  |  |
| `date_to` | query | string | нет |  |  |
| `discipline_id` | query | integer | нет |  | ≥ 1 |
| `municipality_id` | query | integer | нет |  | ≥ 1 |
| `group_kind` | query | string | нет |  | значения: `age`, `academic` |
| `group_id` | query | integer | нет |  | ≥ 1 |

Ответ `200` — реальный ответ демо-стенда на `GET /admin/analytics/participants`:

```json
{
  "block": "participants",
  "title": "Участники и новички",
  "period": {
    "from": "2025-11-01",
    "to": "2026-10-28"
  },
  "previous": {
    "from": "2024-11-04",
    "to": "2025-10-31"
  },
  "months": [
    {
      "month": "2025-11",
      "label": "ноя 2025",
      "participants": 8,
      "newcomers": 2,
      "starts": 8
    },
    "…ещё элементы"
  ],
  "totals": {
    "participants": {
      "value": 35,
      "previous": 18,
      "diff": 17,
      "pct": 94.4
    },
    "newcomers": {
      "value": 17,
      "previous": 18,
      "diff": -1,
      "pct": -5.6
    },
    "starts": {
      "value": 138,
      "previous": 57,
      "diff": 81,
      "pct": 142.1
    }
  }
}
```

