# API-карта

Живой документ: каждая новая фича добавляет сюда свой блок. Порядок блоков — логический путь пользователя.

---

## Общее

**Базовый адрес:** `http://localhost:8000/api/v1`. Swagger: `http://localhost:8000/docs`.

**Формат:** JSON, UTF-8. Даты — `YYYY-MM-DD`, время — ISO 8601 с таймзоной (`2026-10-26T21:37:00+05:00`). Идентификаторы — UUID строкой.

### Куки сессии

| Кука | Что внутри | Флаги | Срок |
|---|---|---|---|
| `sid` | случайный id сессии (32 байта urlsafe) | `HttpOnly`, `SameSite=Lax`, `Path=/` | 7 дней, продлевается при каждом запросе |
| `csrf_token` | случайный токен (32 байта urlsafe) | `SameSite=Lax`, `Path=/`, читается из JS | столько же |

Сама сессия лежит в Redis: `session:{sid}` → `{user_id, email, roles, csrf, created_at}`, где `roles` — роли, дающие доступ к кабинету (`verified` + `athlete` и `coach` в любом статусе).

### CurrentUser

Перед телом любого защищённого эндпоинта срабатывает зависимость `current_user`: читает сессию из Redis по `sid` и отдаёт готовый `CurrentUser {id, email, roles}`. Эндпоинт получает его аргументом (`user: Annotated[CurrentUser, Depends(current_user)]`) и сам ничего не читает. В Postgres на проверку прав не ходим.

`require_role(Role.X)` построен поверх `current_user` и проверяет `Role.X in user.roles`.

Роли в сессиях обновляет домен в момент изменения: подтверждение и отклонение федерацией, запрос роли `athlete`. Он проходит по `user_sessions:{user_id}` и перезаписывает `roles` во всех сессиях пользователя. Поэтому решение федерации действует сразу, без перелогина.

Активной роли нет. Пользователь видит до пяти вкладок — по одной на каждую свою `verified` роль, — и в каждой работают только эндпоинты этой роли.

### Уровни доступа

| Обозначение | Что проверяется | Если нет |
|---|---|---|
| **публично** | ничего | — |
| **сессия** | валидная кука `sid` | 401 `unauthorized` |
| **сессия + csrf** | `sid` + заголовок `X-CSRF-Token` равен `csrf` из сессии | 401 `unauthorized` / 403 `csrf_failed` |
| **роль X** | сессия + у пользователя есть роль X в статусе `verified` (для не-GET ещё и csrf), берётся из `CurrentUser.roles` | 403 `forbidden` |

### Формат ошибки

```json
{
  "error": {
    "code": "validation_error",
    "message": "Проверьте поля формы",
    "fields": {"password": ["Пароль должен содержать заглавную букву", "Пароль должен содержать цифру"]}
  }
}
```

`fields` — словарь «поле → список сообщений», есть только у `validation_error`, в остальных случаях — `null`. Ошибки Pydantic тоже приводим к этому формату.

### Коды ошибок

| HTTP | code | Когда |
|---|---|---|
| 400 | `bad_request` | тело запроса не разбирается как JSON |
| 400 | `invalid_token` | токен сброса пароля не найден, просрочен или уже использован |
| 401 | `unauthorized` | нет сессии или она истекла |
| 401 | `invalid_credentials` | неверный email или пароль |
| 403 | `forbidden` | у пользователя нет нужной роли в статусе `verified` |
| 403 | `csrf_failed` | нет заголовка `X-CSRF-Token` или он не совпал |
| 403 | `account_disabled` | аккаунт деактивирован (`is_active = false`) |
| 404 | `not_found` | объект не найден |
| 409 | `email_taken` | email уже зарегистрирован |
| 409 | `role_already_requested` | роль уже есть в статусе `pending` или `verified` |
| 409 | `name_taken` | значение справочника с таким названием уже есть среди неархивных |
| 409 | `in_use` | значение справочника используется — его можно только архивировать |
| 409 | `invalid_status` | переход статуса невозможен (например, подтвердить уже отклонённую заявку) |
| 409 | `self_moderation` | сотрудник ФСП пытается решить по своей же роли |
| 409 | `registration_closed` | регистрация на соревнование закрыта или окно не наступило / прошло |
| 409 | `has_applications` | удалить соревнование нельзя: на него подали заявки |
| 422 | `validation_error` | тело запроса не прошло проверку |
| 429 | `too_many_attempts` | превышен лимит попыток |

### Перечисления

| Enum | Значения |
|---|---|
| `Role` | `federation`, `organizer`, `athlete`, `coach`, `judge` |
| `RoleStatus` | `pending`, `verified`, `rejected` |

Роли, которые можно выбрать самому: `athlete`, `coach`, `judge`, `organizer`.

| Роль | Статус при создании | Доступ к кабинету | Верификация федерацией |
|---|---|---|---|
| `athlete` | `verified` | сразу | нет |
| `coach` | `pending` | **сразу, при любом статусе** | по желанию: `verified` = значок «верифицированный тренер», `rejected` = без значка |
| `judge` | `pending` | только после `verified` | обязательна |
| `organizer` | `pending` | только после `verified` | обязательна |
| `federation` | `pending` | только после `verified` | обязательна, решает другой сотрудник ФСП |

### Правило пароля

- длина от 8 до 128;
- минимум одна строчная буква (латиница или кириллица);
- минимум одна заглавная буква;
- минимум одна цифра;
- `password == password_repeat`.

Каждое невыполненное правило возвращается отдельным сообщением в `fields.password`.

---

## Фича `health`

### `GET /health`

**Доступ:** публично.

**Ответ 200:**

```json
{"status": "ok", "db": "ok", "redis": "ok"}
```

**Что происходит:**
1. Выполняет `SELECT 1` в Postgres.
2. Выполняет `PING` в Redis.
3. Если что-то упало, в соответствующем поле будет `"fail"`, а `status` — `"degraded"`; код ответа всё равно 200, чтобы было видно, что жив сам API.

---

## Фича `register`

### `POST /auth/register`

**Доступ:** публично.

**Тело `RegisterIn`:**

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `email` | string | да | валидный email, до 255 символов; приводится к lower и обрезаются пробелы |
| `password` | string | да | правило пароля |
| `password_repeat` | string | да | совпадает с `password` |
| `last_name` | string | да | 1–100 символов после trim |
| `first_name` | string | да | 1–100 символов после trim |
| `middle_name` | string \| null | нет | 1–100 символов после trim; пустая строка → `null` |
| `birth_date` | date | да | не в будущем, не раньше 1900-01-01 |
| `roles` | Role[] | да | от 1 до 4 элементов, без повторов, только `athlete`, `coach`, `judge`, `organizer` |
| `pd_consent` | bool | да | строго `true` |

```json
{
  "email": "ivanov@example.test",
  "password": "Qwerty123",
  "password_repeat": "Qwerty123",
  "last_name": "Иванов",
  "first_name": "Иван",
  "middle_name": null,
  "birth_date": "2005-03-01",
  "roles": ["athlete", "coach"],
  "pd_consent": true
}
```

**Ответ 201 `RegisterOut`** + куки `sid`, `csrf_token`:

```json
{
  "id": "6f1c...",
  "email": "ivanov@example.test",
  "last_name": "Иванов",
  "first_name": "Иван",
  "middle_name": null,
  "birth_date": "2005-03-01",
  "roles": [
    {"role": "athlete", "status": "verified", "reject_reason": null, "onboarding_done": false, "created_at": "2026-10-26T21:37:00+05:00"},
    {"role": "coach", "status": "pending", "reject_reason": null, "onboarding_done": false, "created_at": "2026-10-26T21:37:00+05:00"}
  ]
}
```

**Ошибки:** 422 `validation_error`, 409 `email_taken`.

**Что происходит:**
1. Проверяется тело запроса. Выбрать можно любые роли, включая `federation`: она, как судья и организация, ждёт подтверждения.
2. Проверяется, что такого email ещё нет. Если есть — 409 `email_taken`.
3. Пароль хешируется argon2id.
4. В одной транзакции:
   - создаётся запись `users` с `pd_consent_version` = текущая версия текста согласия из настроек и `pd_consent_at` = сейчас;
   - для каждой роли создаётся запись `user_roles`: `athlete` сразу `verified`, остальные `pending`;
   - пишется аудит `auth.register` с перечнем ролей.
5. Если у запроса уже была кука `sid` с живой сессией, старая сессия закрывается.
6. Открывается новая сессия, в неё кладутся роли с доступом (см. таблицу ролей).
7. Ставятся куки, возвращается профиль.

Пользователь без ролей с доступом (например, зарегистрировался только как судья) может входить, смотреть `GET /me` и выходить, но ни в один кабинет его не пустит — фронт показывает «ожидает подтверждения федерацией».

---

## Фича `login`

### `POST /auth/login`

**Доступ:** публично.

**Тело `LoginIn`:**

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `email` | string | да | приводится к lower и trim; формат не валидируем, чтобы не подсказывать |
| `password` | string | да | 1–128 символов, правило пароля **не** проверяем |

```json
{"email": "federation@example.test", "password": "Demo1234"}
```

**Ответ 200 `LoginOut`** + куки: структура как у `RegisterOut`.

**Ошибки:** 401 `invalid_credentials`, 403 `account_disabled`, 429 `too_many_attempts`.

**Что происходит:**
1. Проверяется счётчик `login:{ip}:{email}:counter`. Если там уже 5 — 429, пароль даже не сверяем. В ответе заголовок `Retry-After` с оставшимися секундами.
2. Ищется пользователь по email. Сверяется пароль.
3. Если пользователя нет или пароль не подошёл:
   - счётчик увеличивается на 1, TTL 15 минут ставится при первой ошибке;
   - пишется аудит `auth.login_failed` с email (без пароля);
   - ответ 401 `invalid_credentials`. Сообщение одинаковое в обоих случаях, чтобы нельзя было перебрать существующие email.
4. Если `is_active = false` — 403 `account_disabled`.
5. Успех:
   - счётчик удаляется;
   - если argon2 говорит, что хеш надо пересчитать (сменились параметры), пароль перехешируется;
   - обновляется `last_login_at`;
   - старая сессия из куки, если была, закрывается;
   - открывается новая сессия, в неё кладутся роли с доступом;
   - аудит `auth.login`;
   - ставятся куки, возвращается профиль.

Несколько сессий одного пользователя одновременно разрешены (ноутбук + телефон).

---

## Фича `me`

Всё про текущего пользователя и его роли.

### `GET /me`

**Доступ:** сессия.

**Ответ 200 `MeOut`:** структура как у `RegisterOut` плюс `available_roles` — список ролей, кабинеты которых открыты прямо сейчас:

```json
{"...": "...", "academic_group": {"id": 4, "name": "Студенты"}, "available_roles": ["athlete", "coach"]}
```

`academic_group` — академическая группа человека или `null`; без неё не подать заявку на соревнование.

**Что происходит:**
1. По `sid` достаётся сессия, TTL сессии и куки продлеваются.
2. Из БД читаются пользователь и все его роли со статусами — это единственное место, где нужен полный профиль.
3. Если пользователь деактивирован — закрываются все его сессии, ответ 401.
4. Если `verified` роли в БД разошлись с ролями в сессии (страховка) — сессия обновляется.

Фронт строит вкладки по `available_roles`. По `roles` показывает статусы: у судьи и организатора `pending` / `rejected` — «на проверке» / «отклонена: причина»; у тренера `verified` — значок верификации.

### `PATCH /me`

**Доступ:** сессия + csrf. **Тело:** `{"academic_group_id": 4}` или `{"academic_group_id": null}`. **Ответ 200 `MeOut`.**

**Ошибки:** 422 — не активное значение справочника `academic_groups`. Аудит `profile.update`.

### `POST /me/roles`

Запросить ещё одну роль после регистрации.

**Доступ:** сессия + csrf.

**Тело `RoleRequestIn`:**

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `role` | Role | да | только `athlete`, `coach`, `judge`, `organizer` |

```json
{"role": "judge"}
```

**Ответ 201 `MeOut`.**

**Ошибки:** 409 `role_already_requested`.

**Что происходит:**
1. Ищется запись `user_roles` этого пользователя с этой ролью.
2. Если её нет — создаётся: `athlete` сразу `verified`, остальное `pending`.
3. Если она есть:
   - `pending` или `verified` — 409 `role_already_requested`;
   - `rejected` — та же строка переводится в `pending`, `reject_reason`, `decided_by`, `decided_at` очищаются, `created_at` обновляется на сейчас, чтобы заявка встала в конец очереди.
4. Роли обновляются во всех сессиях пользователя (для `athlete` и `coach` кабинет открывается сразу).
5. Аудит `role.request`.

### `POST /me/roles/{role}/onboarding`

Отметить, что пользователь прошёл навигатор по этой роли.

**Доступ:** сессия + csrf.

**Параметр пути:** `role` — значение `Role`.

**Ответ 204.**

**Ошибки:** 404 `not_found`, если у пользователя нет такой роли (в любом статусе).

**Что происходит:**
1. Для записи `user_roles` ставится `onboarding_done = true`.
2. Повторный вызов ничего не меняет и тоже отдаёт 204.
3. В аудит не пишем — это не значимое действие.

---

## Фича `logout`

### `POST /auth/logout`

**Доступ:** сессия + csrf.

**Ответ 204**, куки `sid` и `csrf_token` удаляются (`Max-Age=0`).

**Что происходит:**
1. Ключ `session:{sid}` удаляется из Redis, `sid` убирается из `user_sessions:{user_id}`.
2. Аудит `auth.logout`.
3. Другие сессии пользователя продолжают жить.

Если сессии уже нет (истекла), ответ всё равно 204 и куки чистятся — фронту не нужно обрабатывать этот случай отдельно. CSRF в таком случае не проверяется.

---

## Фича `password_reset`

### `POST /auth/password/forgot`

**Доступ:** публично.

**Тело `ForgotIn`:**

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `email` | string | да | приводится к lower и trim |

```json
{"email": "athlete@example.test"}
```

**Ответ 202**, всегда, без тела.

**Что происходит:**
1. Проверяется счётчик `forgot:{email}:counter`: не больше 3 запросов в час. Сверх лимита — молча 202, ничего не делаем.
2. Ищется активный пользователь. Если не найден — молча 202 (не раскрываем, есть ли такой email).
3. Генерируется код из 6 цифр: `code:reset:{user_id}:token` (хэш, TTL 15 мин), повторная отправка не чаще раза в 60 с (`:cooldown`). Раньше срока — молча 202, письмо не уходит.
4. Код уходит письмом «Код для сброса пароля» (очередь `outbox`, локально — Mailpit). В лог и аудит не пишется.
5. Аудит `auth.password_reset_requested` (только если пользователь найден).

### `POST /auth/password/verify`

**Доступ:** публично. **Тело:** `{"email": "athlete@example.test", "code": "123456"}` — пробелы в коде допускаются.

**Ответ 200** `{"reset_token": "…"}` — одноразовый токен на 10 минут для `/reset`.

**Ошибки:** 400 `invalid_code`, в `fields.code` — «Неверный код. Осталось попыток: N». После 5 ошибок код сгорает: «Код больше не действует. Запросите новый». Неизвестная почта — тот же 400.

### `POST /auth/password/reset`

**Доступ:** публично.

**Тело `ResetIn`:**

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `token` | string | да | 1–128 символов |
| `password` | string | да | правило пароля |
| `password_repeat` | string | да | совпадает с `password` |

```json
{"token": "q8Zp...", "password": "NewPass123", "password_repeat": "NewPass123"}
```

**Ответ 204.**

**Ошибки:** 400 `invalid_token`, 422 `validation_error`.

**Что происходит:**
1. Сначала проверяется тело (пароль по правилу), токен при ошибке валидации не сгорает.
2. Ищется `pwreset:{sha256(token)}:token`. Нет — 400 `invalid_token`.
3. Ключ удаляется сразу (токен одноразовый).
4. Пароль хешируется и сохраняется.
5. Закрываются **все** сессии пользователя (`user_sessions:{user_id}`), включая текущую, если была.
6. Счётчик неудачных входов по этому email сбрасывается.
7. Почта считается подтверждённой, уходит письмо «Пароль изменён».
8. Аудит `auth.password_reset`.
9. Пользователь не логинится автоматически — фронт отправляет его на страницу входа.

---

## Фича `role_verification`

Модерация аккаунтов федерацией. На модерации роли `coach`, `judge`, `organizer` и `federation`; спортсмен подтверждается сразу и сюда не попадает. Роль `federation` выбирают при регистрации или запрашивают позже, как любую другую; кабинет федерации открывается только после подтверждения другим сотрудником ФСП.

По своим ролям сотрудник ФСП не решает: approve, reject и reset по своей записи — 409 `self_moderation`. Так федерация не может случайно снять доступ сама с себя.

### `GET /admin/role-requests`

**Доступ:** роль `federation`.

**Query:**

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `status` | `pending` \| `verified` \| `rejected` | — | фильтр по статусу модерации |
| `role` | `coach` \| `judge` \| `organizer` \| `federation` | — | вкладка роли; без параметра — все роли на модерации. `athlete` — 422 |
| `search` | string ≤ 200 | — | подстрока ФИО или email, без учёта регистра |
| `state` | `pending` \| `decided` | — | старый фильтр: `decided` = `verified` + `rejected`. Если передан `status`, `state` не учитывается |
| `limit` | int | 50 | 1–200 |
| `offset` | int | 0 | ≥ 0 |

Без `status` и `state` — все статусы.

**Ответ 200 `RoleRequestPage`:**

```json
{
  "items": [
    {
      "id": "a12b...",
      "user": {
        "id": "6f1c...",
        "email": "organizer.pending@example.test",
        "last_name": "Петрова",
        "first_name": "Анна",
        "middle_name": "Сергеевна",
        "birth_date": "1990-07-15"
      },
      "role": "organizer",
      "status": "pending",
      "reject_reason": null,
      "created_at": "2026-10-26T21:37:00+05:00",
      "decided_at": null,
      "decided_by": null
    }
  ],
  "total": 1
}
```

`decided_by` — `{id, email, last_name, first_name}` того, кто принял решение, или `null`.

**Порядок:** сначала `pending` по `created_at` от старых к новым (очередь), затем решённые по `decided_at` от новых к старым.

### `GET /admin/role-requests/counts`

**Доступ:** роль `federation`.

Счётчики для вкладок: сколько заявок ждёт решения по каждой роли.

**Ответ 200 `RoleRequestCounts`:**

```json
{"pending": {"coach": 1, "judge": 1, "organizer": 1, "federation": 0}}
```

### `POST /admin/role-requests/{id}/approve`

**Доступ:** роль `federation` + csrf.

**Ответ 200 `RoleRequestOut`** — одна запись в формате элемента `items` выше.

**Ошибки:** 404 `not_found`, 409 `invalid_status`, 409 `self_moderation`.

**Что происходит:**
1. Запись `user_roles` блокируется (`SELECT ... FOR UPDATE`), чтобы два сотрудника федерации не приняли решение одновременно.
2. Статус должен быть `pending`. Иначе 409 `invalid_status`.
3. Ставится `verified`, `decided_by` = текущий пользователь, `decided_at` = сейчас.
4. Аудит `role.approve` с `{user_id, role}`.
5. Роли обновляются во всех сессиях пользователя: вкладка роли доступна сразу, фронт увидит её при следующем `GET /me`.

### `POST /admin/role-requests/{id}/reject`

**Доступ:** роль `federation` + csrf.

**Тело `RejectIn`:**

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `reason` | string | да | 3–500 символов после trim |

```json
{"reason": "Не подтверждена квалификация тренера, приложите документ"}
```

**Ответ 200 `RoleRequestOut`.**

**Ошибки:** 404 `not_found`, 409 `invalid_status`, 409 `self_moderation`, 422 `validation_error`.

**Что происходит:**
1. Блокировка записи, как в approve.
2. Статус должен быть `pending`.
3. Ставится `rejected`, `reject_reason`, `decided_by`, `decided_at`.
4. Роли в сессиях пользователя пересинхронизируются. Отклонённый судья / организатор доступа и не имел, отклонённый тренер доступ сохраняет — теряет только значок.
5. Аудит `role.reject` с `{user_id, role, reason}`.
6. Пользователь видит причину в `GET /me` и может запросить роль заново через `POST /me/roles`.

### `POST /admin/role-requests/{id}/reset`

**Доступ:** роль `federation` + csrf.

Снять решение: подтверждённая или отклонённая роль снова ждёт проверки.

**Тело `ResetIn`** (необязательное):

| Поле | Тип | Обязательно | Проверки |
|---|---|---|---|
| `reason` | string \| null | нет | 3–500 символов после trim; пишется только в аудит |

**Ответ 200 `RoleRequestOut`.**

**Ошибки:** 404 `not_found`, 409 `invalid_status` (роль уже `pending`), 409 `self_moderation`.

**Что происходит:**
1. Блокировка записи, как в approve.
2. Статус должен быть `verified` или `rejected`.
3. Ставится `pending`; `reject_reason`, `decided_by`, `decided_at` очищаются, `created_at` остаётся прежним — запись встаёт в очередь по дате исходной заявки.
4. Роли в сессиях пользователя пересинхронизируются: судья, организация и сотрудник ФСП сразу теряют доступ к кабинету роли, тренер работает дальше без значка.
5. Аудит `role.reset` с `{user_id, role, previous, reason?}`.

---

## Фичи `cabinets/*` — удалены

Заглушки кабинетов с выдуманными данными удалены в Ivan-003: фронт их не использовал, реальные разделы (справочники, соревнования) работают своими эндпоинтами.

---

## Фичи `dictionaries/read` и `dictionaries/manage`

Справочники: 11 штук, набор фиксирован в коде (`Dictionary.REGISTRY`). У каждого справочника свои пути — в Swagger видна точная схема. Подробные правила — [004_tz_dictionaries.md](004_tz_dictionaries.md).

Ключи (`{key}`) в порядке каталога: `disciplines`, `municipalities`, `organization_types`, `academic_groups`, `age_groups`, `contest_types`, `contest_levels`, `contest_formats`, `rank_types`, `judge_categories`, `judge_positions`.

### Запись справочника

Общие поля у всех:

```json
{"id": 1, "name": "Алгоритмическое программирование", "description": "…", "is_archived": false, "created_at": "…", "updated_at": "…"}
```

Свои поля:

| Справочник | Поля |
|---|---|
| `age_groups` | `min_age: int \| null`, `max_age: int \| null` |
| `rank_types` | `rank_kind: "Спортивный разряд" \| "Юношеский разряд" \| "Спортивное звание"`, `min_age: int \| null`, `validity_months: int \| null`, `is_lifetime: bool`, `valid_until_age: int \| null` |
| `judge_categories` | `validity_months: int \| null` |

### `GET /dictionaries`

**Доступ:** публично. **Ответ 200:** `[{"key": "disciplines", "title": "Дисциплины"}, …]` в порядке реестра.

### `GET /dictionaries/{key}`

**Доступ:** публично. **Ответ 200:** неархивные записи в порядке добавления (демо-данные заведены в логичном порядке, новые — в конец). Для выпадающих списков в формах. Неизвестный ключ — 404.

### `GET /admin/dictionaries/{key}?include_archived=false`

**Доступ:** роль `federation`. **Ответ 200:** записи в порядке добавления, с архивными, если `include_archived=true`.

### `POST /admin/dictionaries/{key}`

**Доступ:** роль `federation` + csrf. **Тело:** `name` (1–200, обрезаются пробелы), `description?` (до 2000, пустая строка → `null`) + свои поля справочника. Лишние поля — 422.

**Ответ 201:** созданная запись.

**Ошибки:**
- 409 `name_taken` — такое название уже есть среди неархивных (без учёта регистра);
- 422 `validation_error` — типы и диапазоны (возраст 0–100, срок 1–1200 мес.) и правила по полям:

| Нарушение | `fields` |
|---|---|
| разряд не пожизненный и без срока | `{"validity_months": ["Укажите срок действия"]}` |
| пожизненный, но срок указан | `{"validity_months": ["У пожизненного звания срока нет"]}` |
| `min_age` пустой не у «Спортивного звания» | `{"min_age": ["Укажите минимальный возраст"]}` |
| `valid_until_age` не у «Юношеского разряда» | `{"valid_until_age": ["Только для юношеских разрядов"]}` |
| возрастная группа без обеих границ | `{"min_age": ["Укажите хотя бы одну границу"]}` |
| `max_age < min_age` | `{"max_age": ["Не может быть меньше «от»"]}` |

**Что происходит:** проверка правил → проверка названия → запись → аудит `dictionary.create`.

### `PATCH /admin/dictionaries/{key}/{id}`

**Доступ:** роль `federation` + csrf. **Тело:** любые поля как при создании, все необязательные; переданный `null` в `name`, `rank_kind`, `is_lifetime` — 422.

**Ответ 200:** запись. **Ошибки:** 404, 409 `name_taken`, 422.

**Что происходит:** правила проверяются на итоговых значениях (старые + новые) — например, `{"is_lifetime": true}` у разряда со сроком даст 422. Переименование разрешено. Аудит `dictionary.update` со старыми и новыми значениями изменённых полей.

### `DELETE /admin/dictionaries/{key}/{id}`

**Доступ:** роль `federation` + csrf. **Ответ 204.**

**Ошибки:** 404; 409 `in_use` — на запись ссылаются другие таблицы (внешние ключи `ON DELETE RESTRICT`), её можно только архивировать.

**Что происходит:** физическое удаление; если БД отказала по внешнему ключу — откат и 409. Аудит `dictionary.delete` с удалёнными значениями.

### `POST /admin/dictionaries/{key}/{id}/archive` и `/restore`

**Доступ:** роль `federation` + csrf. **Ответ 200:** запись.

- `archive` — запись пропадает из публичного списка, старые ссылки на неё остаются рабочими. Повторный вызов ничего не меняет.
- `restore` — если среди неархивных уже есть запись с таким названием — 409 `name_taken`.

Аудит: `dictionary.archive`, `dictionary.restore`.
## Календарь: события ФСП и соревнования

Публичная лента объединяет **опубликованные события ФСП** (лекции, сборы, вебинары — то, что не соревнование) и **действительные соревнования** (все, кроме черновиков и архива; отменённые — со статусом «Отменено»). Данные Минспорта / Минцифры удалены.

### `GET /calendar/events`

**Доступ:** публично.

**Query:** `date_from` (по умолчанию сегодня, Екатеринбург), `date_to` (по умолчанию +365 дней, период не больше 367 дней), `kind=event|contest` (по умолчанию оба), `q` (поиск по названию), `limit` (1–200, 50), `offset`.

**Ответ 200:** `{items, total}`, элементы по дате начала:

```json
{
  "kind": "contest",
  "id": "contest-1",
  "contest_id": 1,
  "title": "…",
  "description": "…",
  "start_date": "2026-11-16",
  "end_date": "2026-11-17",
  "starts_at": null,
  "ends_at": null,
  "location": "г. Оренбург, ОГУ, корпус 2",
  "is_online": false,
  "registration_url": null,
  "status": "registration_open",
  "status_title": "Регистрация открыта",
  "is_verified": true,
  "updated_at": "…"
}
```

`start_date` / `end_date` — дни по Оренбургу для сетки календаря. У события есть время: `starts_at` / `ends_at` (ISO с часовым поясом), у соревнования — `null`. У события `kind: "event"`, `id` — UUID события, `contest_id: null`, `status: "published"`, `is_verified: false`. Карточка события — `GET /calendar/events/{id}`, карточка соревнования — `GET /contests/{contest_id}`.

### `GET /calendar/events/{id}`

Опубликованное событие ФСП: `{id, title, description, starts_at, ends_at, location, is_online, registration_url, status, updated_at}`; иначе 404.

### Управление событиями ФСП (роль `federation`)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/admin/calendar/events?q=&limit=&offset=` | все события, включая черновики и архив; `{items, total}` |
| GET | `/admin/calendar/events/{id}` | событие |
| POST | `/admin/calendar/events` | создать черновик |
| PATCH | `/admin/calendar/events/{id}` | правка (архив — 409) |
| POST | `/admin/calendar/events/{id}/publish` · `/unpublish` · `/archive` | `draft → published`, `published → draft`, `→ archived` |

Создание: `title` (1–300), `description` (до 20 000), `starts_at`, `ends_at` (ISO с часовым поясом, оба обязательны), `location?` (до 500), `is_online`, `registration_url?` (http/https). Не онлайн — место обязательно, окончание строго позже начала (`ends_at` в 422). 409 — недопустимый переход, 422 — поля. Аудит: `calendar.create`, `calendar.update`, `calendar.publish`, `calendar.unpublish`, `calendar.archive`.

Соревнования через этот раздел не создаются — у них свои эндпоинты (раздел «Соревнования»).

---

## Фичи `contests/calendar`, `contests/organizer`, `contests/admin`

Соревнования. Правила и статусы — [007_tz_contests.md](007_tz_contests.md). Положение и фото — после влития модуля файлов.

### Карточка `ContestOut`

`id`, `title`, `description`, `discipline`, `contest_type`, `contest_level`, `contest_format`, `municipality` (`{id, name}` или `null`), `venue`, `age_groups[]`, `academic_groups[]` (`{id, name}`), `participation_type` (`individual` / `team`) + `participation_type_title`, `team_size_min`, `team_size_max`, `starts_on`, `ends_on`, `registration_opens_at`, `registration_closes_at`, `prize_fund_text`, `prize_fund_amount`, `status` + `status_title`, `cancel_reason`, `is_verified`, `rating_points` (`[{place, points}]`, публично — только у верифицированных), `organizer` (`{id, last_name, first_name, middle_name, full_name}`), `published_at`.

Владельцу и федерации ещё: `verification_status` + `verification_title`, `verification_reason`, `verification_requested_at`, `verified_at`, `created_at`, `updated_at`.

Списки: `{items: ContestOut[], total}`, `limit` (1–200, по умолчанию 50), `offset`.

### Тело создания / правки

`title`, `description?`, `discipline_id`, `contest_type_id`, `contest_level_id`, `contest_format_id`, `participation_type`, `team_size_min?`, `team_size_max?`, `municipality_id?`, `venue?`, `age_group_ids[]`, `academic_group_ids[]`, `starts_on`, `ends_on`, `registration_opens_at`, `registration_closes_at` (с часовым поясом), `prize_fund_text?`, `prize_fund_amount?`. Федерации дополнительно `organizer_id?` и при создании `rating_points?` (сразу верифицировано). PATCH — любые поля необязательно; лишние поля (в т.ч. `rating_points` / `verification_*` у организатора) → 422.

422 по полям: архивное / несуществующее значение справочника, `ends_on` раньше `starts_on`, регистрация закрывается не позже открытия или после дня начала, не онлайн без муниципалитета, командное без размера команды / размер у личного, неверные `rating_points` (места подряд с 1, баллы ≥ 0).

### Публично

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/contests` | календарь: все статусы, кроме черновика и архива. Фильтры: `discipline_id`, `contest_level_id`, `contest_format_id`, `participation_type`, `age_group_id`, `academic_group_id`, `municipality_id`, `status`, `verified_only`, `has_prize_fund`, `date_from`, `date_to`, `search`, `period=upcoming\|past\|all` (по умолчанию `upcoming`: ближайшие сначала; `past` — свежие сначала), `sort=date_desc\|date_asc\|created_desc\|title` — явный порядок поверх `period` |
| GET | `/contests/{id}` | карточка; черновик / архив → 404 |

### Организатор (роль `organizer`, только свои; чужое → 404)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/organizer/contests?status=&verification_status=&search=&sort=` | свои; `sort` как в календаре, по умолчанию свежие по дате начала |
| GET | `/organizer/contests/{id}` | своя карточка |
| POST | `/organizer/contests` | создать черновик → 201 |
| PATCH | `/organizer/contests/{id}` | правка в любом статусе, кроме архива (409). Правка полей рейтинга у верифицированного → верификация «На проверке» |
| DELETE | `/organizer/contests/{id}` | 204; идёт / завершено / архив → 409 |
| POST | `/organizer/contests/{id}/publish` · `/unpublish` · `/open-registration` · `/close-registration` · `/start` · `/complete` · `/archive` | переходы; неверный → 409 |
| POST | `/organizer/contests/{id}/cancel` | `{reason}` (3–500) |
| POST | `/organizer/contests/{id}/request-verification` | из «не запрошена» / «отказано» → «на проверке», иначе 409 |

### Федерация (роль `federation`, любые соревнования)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/admin/contests` | все; фильтры как в календаре (без `period`) + `status`, `verification_status`, `organizer_id`, `sort`. Очередь: `?verification_status=pending` — по времени запроса |
| GET | `/admin/contests/rating-points-defaults` | `[{level: {id, name}, rating_points}]` — баллы по умолчанию для формы верификации |
| GET | `/admin/contests/{id}` | карточка |
| POST | `/admin/contests` | создать (своё или за организатора через `organizer_id`) |
| PATCH | `/admin/contests/{id}` | правка; верификацию не сбрасывает |
| DELETE | `/admin/contests/{id}` | как у организатора |
| POST | `…/publish` · `/unpublish` · `/open-registration` · `/close-registration` · `/start` · `/complete` · `/archive` · `/cancel {reason}` | переходы |
| POST | `/admin/contests/{id}/verify` | `{rating_points?}`; без баллов — по уровню соревнования |
| PATCH | `/admin/contests/{id}/rating-points` | баллы верифицированного зафиксированы → 409 `points_locked`; иначе 409 `invalid_status`. Изменить — снять верификацию и верифицировать заново |
| POST | `/admin/contests/{id}/reject-verification` | `{reason}` — только из «на проверке» |
| POST | `/admin/contests/{id}/revoke-verification` | верифицировано → не запрошена, баллы сбрасываются |

Аудит: `contest.create`, `contest.update`, `contest.delete`, `contest.status`, `contest.verification`. Удаление значения справочника, на которое ссылается соревнование, → 409 `in_use`.

---

## Фичи `files/upload` и `files/download`

Хранилище — SeaweedFS (S3-совместимое) в том же контейнере, порт 9000. Два бакета: `fsp-public` (читается анонимно по постоянной ссылке) и `fsp-private` (только через API).

### `POST /files`

**Доступ:** сессия + csrf. **Тело:** `multipart/form-data`, поле `file`.

**Ответ 201:** `{"id", "original_name", "content_type", "size", "is_public": false, "url": "/api/v1/files/{id}"}`.

**Ошибки:** 413 `file_too_large` (больше 10 МБ), 415 `unsupported_file_type`.

**Что происходит:** тип определяется по содержимому (сигнатуре), а не по расширению: JPEG, PNG, WebP, PDF, DOCX, XLSX, ZIP. Файл кладётся в приватный бакет, запись — в `files`, аудит `file.upload`. Публичным файл становится только через владельца-сущность (например, публикация соревнования).

### `GET /files/{id}`

**Доступ:** публичный файл — кто угодно; приватный — загрузивший или федерация, остальным 404.

**Ответ 307:** редирект на постоянную ссылку (публичный) или на подписанную ссылку на 5 минут (приватный).

### Файлы в соревнованиях
- `regulations_file_id` — PDF или DOCX; `photo_file_ids` — до 10 изображений, порядок = порядок в галерее. Передаются в теле создания / правки соревнования.
- Можно привязать только свои файлы (федерация — любые); уже привязанные к соревнованию остаются доступными при правке.
- 422 по полям: «Только изображения JPEG, PNG или WebP», «Загрузите положение в формате PDF или DOCX», «Файл не найден или загружен не вами», «Не больше 10 фото».
- Соревнование в публичном статусе → его файлы в публичном бакете; черновик / архив → в приватном. Убранные из соревнования файлы становятся приватными. В карточке: `regulations: {id, original_name, content_type, size, url} | null`, `photos: [...]`.

---

## Область `applications`: заявки на участие и команды

Логика, статусы и проверки — [010_tz_applications.md](010_tz_applications.md).

### Заявка `ApplicationOut`

```json
{
  "id": 5,
  "contest": {"id": 3, "title": "Открытый турнир по ИБ (CTF)", "participation_type": "team", "team_size_min": 2, "team_size_max": 4, "starts_on": "2026-11-10", "status": "registration_open", "...": "поля карточки соревнования"},
  "team_name": "Ночные совы",
  "status": "submitted",
  "status_title": "На рассмотрении",
  "created_as": "athlete",
  "creator": {"id": "…", "last_name": "Кузнецов", "first_name": "Илья", "middle_name": "Петрович"},
  "reject_reason": null,
  "submitted_at": "2026-10-27T10:00:00Z",
  "decided_at": null,
  "created_at": "2026-10-27T09:00:00Z",
  "members": [
    {
      "user": {"id": "…", "last_name": "Кузнецов", "first_name": "Илья", "middle_name": "Петрович", "birth_date": "2001-08-14", "academic_group": {"id": 4, "name": "Студенты"}},
      "is_captain": true,
      "confirmation": "confirmed",
      "confirmation_title": "Подтвердил",
      "is_active": true,
      "age_group": {"id": 3, "name": "18 лет и старше"},
      "academic_group": {"id": 4, "name": "Студенты"},
      "responded_at": "2026-10-27T09:00:00Z"
    }
  ]
}
```

`members[].age_group` и `members[].academic_group` — снимок на момент подачи, до подачи `null`. `status`: `forming`, `submitted`, `approved`, `rejected`, `withdrawn`. `confirmation`: `invited`, `confirmed`, `declined`.

### Спортсмен и тренер (роль `athlete` или `coach`)

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/athletes/search` | `q` (2–200): части ФИО или email, слова в любом порядке; `contest_id?` | `{items: [{id, last_name, first_name, middle_name, birth_date, academic_group, problems}]}` — до 20; `problems` только с `contest_id`, пустой список = подходит |
| GET | `/me/available-contests` | `as=athlete\|coach` (по умолчанию — спортсмен, если есть такая роль) | `{items: [{contest, problems}]}` — регистрация открыта; `as=athlete`: без тех, куда он уже заявлен, `problems` — почему не проходит; `as=coach`: все, `problems` пустые |
| GET | `/me/applications` | `as=athlete\|coach` | `{items: [ApplicationOut]}` — как участник (включая приглашения) или собранные тренером |
| POST | `/contests/{id}/applications` | `{as, team_name?, member_ids[], captain_id?}` | 201 `ApplicationOut` |
| POST | `/contests/{id}/applications/batch` | `{member_ids[]}` 1–100, роль `coach`, только личные соревнования | 201 `{items: [ApplicationOut]}` — по заявке на каждого; всё или ничего: 422 `member_ids` со списком «ФИО: причины» |
| GET | `/applications/{id}` | — | участникам, создателю, организатору соревнования, федерации; иначе 404 |
| PATCH | `/applications/{id}` | `{team_name}` | переименовать команду |
| POST | `/applications/{id}/members` | `{user_id}` | пригласить |
| DELETE | `/applications/{id}/members/{user_id}` | — | убрать (капитана — нельзя) |
| POST | `/applications/{id}/submit` · `/withdraw` | — | подать · отозвать |
| POST | `/applications/{id}/confirm` · `/decline` | — | ответ на приглашение, `decline` после подтверждения — выйти |

Создание:
- `as=athlete` — спортсмен в составе сам. Личная заявка сразу `submitted`. Командная — `forming`, автор капитан, `member_ids` — приглашённые.
- `as=coach` — тренер в состав не входит. Личная: ровно один `member_ids`, после его подтверждения заявка сама уходит в `submitted`. Командная: `captain_id` — кто из состава капитан (может быть пустым).

Ошибки:
- 409 `registration_closed`;
- 422 `team_name` — нет названия или занято;
- 422 `members` / `member_ids` / `user_id` — список «ФИО: причины», например `Белова Мария: уже заявлен на это соревнование`, `Вы: не указана академическая группа`;
- 422 `members` при подаче — кто не подтвердил, размер команды, кто не проходит;
- 409 `invalid_status` — действие недоступно в текущем статусе заявки или соревнования;
- 403 — нет роли, от лица которой подаётся заявка.

### Организатор (`/organizer/...`, только свои соревнования) и федерация (`/admin/...`, любые)

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/organizer/applications/contests` | `limit`, `offset` | `{items: [{contest: {id, title, discipline, participation_type, team_size_min, team_size_max, starts_on, ends_on, registration_closes_at, status, organizer}, counts: {forming, submitted, approved, rejected, withdrawn}}], total}` — сначала те, где есть заявки на рассмотрении |
| GET | `/organizer/contests/{id}/applications` | `status?`, `search?` (команда, ФИО, email), `limit`, `offset` | `{items, total}`; без `status` — все, кроме отозванных; сначала `submitted` |
| POST | `/organizer/applications/{id}/approve` · `/reset` | — | `ApplicationOut` |
| POST | `/organizer/applications/{id}/reject` | `{reason}` 3–500 | `ApplicationOut` |
| POST | `/organizer/applications/approve` | `{ids[]}` 1–200 | `{items}` — всё или ничего |
| POST | `/organizer/applications/reject` | `{ids[], reason}` | `{items}` — всё или ничего |

В заявке модерации у людей есть `email`, вместо `contest` — `contest_id`, решивший — `decided_by`.

Переходы: `submitted → approved`, `submitted → rejected`, `approved / rejected → submitted`. Соревнование в `registration_open` или `registration_closed`, иначе 409 `invalid_status`. Отклонение освобождает участников для других заявок; возврат отклонённой — 422 `ids`, если кто-то из них уже в другой заявке.

### Публично

`GET /contests/{id}/participants` → `{items: [{team_name, members: [{last_name, first_name, middle_name}]}], total_people}` — только одобренные.



---

## Область `people`: страница человека и лента

Правила видимости и ленты — [011_tz_people_certificates.md](011_tz_people_certificates.md).

### Страница `PersonOut`

```json
{
  "id": "…",
  "name": "Соколов Артём Игоревич",
  "last_name": "Соколов",
  "first_name": "Артём",
  "middle_name": "Игоревич",
  "birth_date": "2006-03-01",
  "academic_group": {"id": 4, "name": "Студенты"},
  "avatar_url": null,
  "roles": ["athlete"],
  "is_owner": false,
  "masked": false
}
```

- `roles` — подтверждённые роли из `athlete`, `coach`, `judge`, `organizer`. Сотрудник ФСП показывается как `organizer`.
- Страница открыта всем, вход не нужен. Несовершеннолетнего посторонний видит с `masked: true`: `name` — «Имя Ф.», `last_name`, `middle_name`, `birth_date` и `avatar_url` — `null`. Владелец и федерация видят всё.

| Метод | Путь | Доступ | Тело / query | Ответ |
|---|---|---|---|---|
| GET | `/people/{id}` | публично | — | `PersonOut`; нет подтверждённых ролей → 404 |
| GET | `/people/{id}/avatar` | публично | — | 302 на файл фото (кеш 5 минут); 404 — фото нет или несовершеннолетний для постороннего |
| GET | `/people/{id}/wall` | публично | `role=athlete\|coach\|organizer`, `limit` 1–50, `offset` | `{items: [{contest: {id, title, discipline, contest_level, contest_format, participation_type, starts_on, ends_on, status}, team_name, athletes, place, disqualified, post}], total}` |
| PATCH | `/me/page` | сессия + csrf | `{avatar_file_id?}`; `null` убирает аватар | `PersonOut` |
| PUT | `/me/wall/{role}/{contest_id}` | сессия + csrf | `{text?, photo_ids[] до 10, is_hidden}` | `{id, contest_id, text, is_hidden}` |
| PATCH | `/admin/wall-posts/{id}` | роль `federation` | `{hidden_by_federation}` | `{id, hidden_by_federation}` |

`post`: `{id, text, photos: [{id, url}], is_hidden, hidden_by_federation}` или `null`, если владелец ещё ничего не дописал.

- Лента по роли: спортсмен — одобренные заявки, где он в составе; тренер — одобренные заявки, которые он подал (`athletes` — сколько подопечных); организатор — свои соревнования. `place`: у спортсмена — его место, у тренера — лучшее место подопечных, `null` — мест ещё нет; `disqualified` — спортсмен дисквалифицирован. Без черновиков, архива и отменённых, по дате начала, новые сверху.
- Скрытый пост (`is_hidden` или `hidden_by_federation`) видят только владелец и федерация, остальным соревнование в ленте не показывается.
- Ошибки `PUT`: 403 — нет такой подтверждённой роли или соревнования нет в ленте; 422 `photo_ids` — чужой файл или не изображение.

---

## Справки с QR

Справки выпускаются движком документов — раздел «Область `documents`» ниже. Таблица `certificates` и `/verify/{token}` убраны.


---

## Codeforces в профиле

Справочно: хэндл и рейтинг Codeforces показываются на странице человека и ни на что в системе не влияют, в рейтинг спортсменов ФСП не входят. Владение хэндлом не проверяется, уникальности нет.

| Метод | Путь | Доступ | Тело | Ответ |
|---|---|---|---|---|
| PUT | `/me/codeforces` | сессия + csrf | `{handle}` — латиница, цифры, `_`, `-`, `.`, до 24 символов | блок `codeforces`; сразу пробует обновить рейтинг. Неверный формат → 422 `handle` |
| DELETE | `/me/codeforces` | сессия + csrf | — | 204 |

Блок `codeforces` в `GET /me` и `GET /people/{id}`:

```json
{"handle": "tourist", "url": "https://codeforces.com/profile/tourist", "rating": 3500, "max_rating": 4000, "rank": "legendary grandmaster", "status": "ok", "updated_at": "2026-10-28T10:00:00Z"}
```

- `status`: `pending` — ещё не обновляли, `ok`, `not_found` — хэндла нет на Codeforces. У `ok` без раундов `rating` пустой.
- Новый хэндл — `pending`, рейтинг, максимум и ранг сбрасываются. Убрать хэндл — все поля `null`. Изменения пишутся в журнал как `profile.update`.
- Воркер в процессе API: при старте и раз в час, `user.info` пачками по 300, между запросами не меньше 2 с. Несуществующий хэндл помечается `not_found` и убирается из пачки, остальные обновляются. Codeforces недоступен — значения не трогаем, ждём следующего часа. Настройки `FSP_CODEFORCES_*`.

---

## Уведомления

ТЗ и каталог событий — [006_tz_notifications_audit.md](006_tz_notifications_audit.md). Все пути требуют сессию, изменяющие — ещё и CSRF. Только уведомления текущего пользователя.

| Метод | Путь | Результат |
|---|---|---|
| GET | `/notifications?unread_only=false&limit=20&offset=0` | `{items, total}`, новые сверху |
| GET | `/notifications/unread-count` | `{count}` |
| POST | `/notifications/{id}/read` | 204, повторно тоже 204 |
| POST | `/notifications/read-all` | 204 |

`limit` 1–100. Чужой или несуществующий id — 404, без сессии — 401, неверный CSRF — 403.

Элемент: `id`, `type`, `title`, `text`, `link` (внутренний путь или `null`), `is_read`, `created_at`, `email_status` (`not_required|pending|sent|failed`), `email_sent_at`. Очередь писем через API не выдаётся.

| `type` | Кому | Письмо |
|---|---|---|
| `role.requested` | федерация | — |
| `role.approved`, `role.rejected`, `role.reset` | владелец роли | да |
| `contest.verification_requested` | федерация | — |
| `contest.verified`, `contest.verification_rejected`, `contest.verification_revoked` | организатор | да |
| `contest.cancelled` | участники и тренеры живых заявок | да |
| `application.invited` | приглашённый спортсмен | — |
| `application.member_declined` | капитан или тренер — автор заявки | — |
| `application.submitted` | организатор соревнования | — |
| `application.approved`, `application.rejected`, `application.reset` | участники заявки и тренер — автор | да |
| `certificate.revoked` | владелец справки | да |

`auth.password_reset` — только письмо, в ленту не попадает. Инициатор действия уведомлений о себе не получает.

Безопасность (всегда в кабинет, на почту и в Telegram, отключить нельзя): `auth.password_changed`, `auth.new_device`, `auth.email_changed` (ещё и на старый адрес), `system.test` — проверка доставки. Письма-уведомления о решениях уходят только на подтверждённую почту.

---

## Почта, Telegram и настройки уведомлений

ТЗ — [011_tz_mail_telegram.md](011_tz_mail_telegram.md). Сессия, изменяющие — с CSRF.

| Метод | Путь | Результат |
|---|---|---|
| POST | `/me/email/verify/send` | 204 — новый код подтверждения; раньше 60 с — 429 с `Retry-After`; уже подтверждена — 409 |
| POST | `/me/email/verify` `{code}` | 204; неверный код — 400 `invalid_code` |
| POST | `/me/email/change` `{new_email, password}` | 204 — код на новый адрес; неверный пароль — 422, занятый адрес — 409 `email_taken` |
| POST | `/me/email/change/confirm` `{code}` | 204; почта заменена и подтверждена, все сессии закрыты, ответ ставит новую сессию |
| GET | `/me/notification-settings` | `{items: [{group, label, description, email, telegram, locked}]}` |
| PUT | `/me/notification-settings` `{items: [{group, channel, enabled}]}` | та же матрица; `security` не меняется |
| POST | `/me/notifications/test` | 204 — тестовое уведомление во все подключённые каналы |
| GET | `/me/telegram` | `{available, bot, linked, username, linked_at, mailpit_url}` |
| POST | `/me/telegram/link` | `{url}` — `https://t.me/<bot>?start=<токен на 10 мин>`; без токена бота на сервере — 409 |
| DELETE | `/me/telegram` | 204 |

В `/me` — поле `email_verified`. Группы: `security`, `roles`, `contests`, `applications`, `moderation`.

### Администраторы Telegram-бота (только федерация)

| Метод | Путь | Результат |
|---|---|---|
| GET | `/admin/telegram/admins` | `{my_level, can_manage, levels: [{code, label, rights}], items: [{user_id, full_name, email, level, linked, granted_by, created_at}]}` |
| POST | `/admin/telegram/admins` `{email, level}` | 204; только владелец; назначить можно только подтверждённого сотрудника федерации |
| PATCH | `/admin/telegram/admins/{user_id}` `{level}` | 204; только владелец; последнего владельца не понизить — 409 |
| DELETE | `/admin/telegram/admins/{user_id}` | 204; только владелец; последнего владельца не снять — 409 |

Уровни: `moderator` — очередь и решения по ролям в боте; `admin` — плюс статистика и рассылка; `owner` — плюс управление администраторами.

---

## Журнал действий

Только федерация: остальным 403, без сессии 401. API изменения и удаления нет.

| Метод | Путь | Результат |
|---|---|---|
| GET | `/admin/audit?q=&user_id=&action=&object_type=&date_from=&date_to=&limit=20&offset=0` | `{items, total}`, новые сверху |
| GET | `/admin/audit/catalog` | `{actions: [{code, label}], objects: [{code, label}]}` — все действия и типы объектов для фильтров |

- `q` — поиск автора по email и ФИО (до 100 символов), `user_id` — точный автор.
- `date_from`, `date_to` (`YYYY-MM-DD`) — целые дни по Оренбургу, обратный диапазон — 422.
- Элемент: `id`, `created_at`, `user: {id, full_name, email} | null`, `action`, `action_label`, `object_type`, `object_label`, `object_id`, `payload`, `ip`.
- Ключи `payload` с паролями, токенами, секретами и cookie вырезаются; значения `token=…` в строках скрываются.
- Изменения полей лежат в `payload.changes` (соревнования) или `payload.values` (справочники) в виде `{поле: {old, new}}`; смена статуса — `from` / `to`.

---

## Новости

ТЗ — [005_tz_files_news.md](005_tz_files_news.md), часть 2. Статусы: `draft`, `published`, `archived`. Сайт видит только опубликованные.

### Статья `ArticleOut`

```json
{
  "id": "…",
  "slug": "itogi-regionalnogo-etapa-3f9a1c",
  "title": "Итоги регионального этапа",
  "section": "Соревнования",
  "summary": "24 команды за 48 часов",
  "cover_file_id": "…",
  "blocks": [
    {"type": "heading", "text": "Победители", "level": 2},
    {"type": "text", "text": "Абзац

Абзац"},
    {"type": "image", "file_id": "…", "caption": null, "alt": null},
    {"type": "file", "file_id": "…", "title": "Положение"},
    {"type": "link", "url": "https://fsp-russia.ru/", "title": "ФСП России"}
  ],
  "hashtags": ["соревнования"],
  "status": "published",
  "published_at": "2026-10-25T10:00:00Z",
  "created_at": "…",
  "updated_at": "…",
  "views": 12
}
```

Публичный ответ — без `status`, `created_at`, `updated_at`. Файлы обложки и блоков открываются по `/api/v1/files/{file_id}`.

### Публично

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/news?q=&section=&tag=&limit=12&offset=0` | `{items, total}`; `q` — по заголовку и анонсу; новые первыми |
| GET | `/news/tags` | `[{name, count}]` по опубликованным |
| GET | `/news/{slug}` | статья; черновик и архив → 404; просмотр засчитывается раз в сутки на посетителя |

### Федерация (роль `federation`)

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/admin/news` | `q`, `status?`, `tag?`, `limit` (до 100), `offset` | `{items, total}` |
| GET | `/admin/news/{id}` | — | `ArticleOut` |
| POST | `/admin/news` | `{title, section?, summary?, cover_file_id?, blocks[], hashtags[]}` | 201, черновик |
| PATCH | `/admin/news/{id}` | те же поля, любые | `ArticleOut`; опубликованная меняется на сайте сразу |
| POST | `/admin/news/{id}/publish` · `/unpublish` · `/archive` · `/restore` | — | `ArticleOut` |

Правила:
- `title` 1–200, `section` до 100, `summary` до 500, блоков до 100, текст блока до 20 000, ссылки только http/https.
- Хэштеги: до 10, 2–50 символов без пробелов, `#` срезается, приводятся к нижнему регистру, повторы убираются.
- Обложка и `image` — JPEG, PNG или WebP; `file` — любой допустимый тип из `POST /files`.
- Публикация без блоков → 422 `blocks`. Переход не из того статуса и правка архива → 409 `invalid_status`. `restore` возвращает архив в черновик.
- Файлы статьи в публичном бакете, пока она опубликована; убранные из статьи становятся приватными.
- Первая публикация ставит `published_at`, повторная его не меняет.
- Аудит: `news.create`, `news.update`, `news.publish`, `news.unpublish`, `news.archive`, `news.restore`.

---

## Область `results`: места соревнования

ТЗ — [012_tz_results_rating_documents.md](012_tz_results_rating_documents.md). Одна строка на спортсмена: место и баллы; команда — одно место и одни баллы на всех участников. `place: null` — дисквалификация.

### Публично

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/contests/{id}/results` | `{participation_type, is_verified, items: [{place, points, team_name, athletes: [{id, full_name}]}]}`; дисквалифицированные внизу; непубличный статус → 404 |

### Организатор (`/organizer/...`, только свои) и федерация (`/admin/...`, любые)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/contests/{id}/results` | — | `{contest_id, status, participation_type, editable, items: [{application_id, team_name, athletes, entered, place}]}` — все одобренные заявки |
| PUT | `/contests/{id}/results` | `{items: [{application_id, place}]}` | то же; места пересоздаются целиком |
| GET | `/contests/{id}/results/protocol.xlsx` | — | файл протокола |

Правила:
- Вносить можно в `in_progress` и `completed`, иначе 409 `invalid_status`.
- Каждая одобренная заявка ровно один раз → иначе 422 `items`. Места без повторов и пропусков, подряд с 1; иначе 422 `items`. Команда — одно место на всех участников.
- Баллы — по `rating_points` верифицированного соревнования, места вне таблицы и дисквалификация — 0. Верификация пересчитывает баллы внесённых мест, снятие верификации обнуляет.
- Уведомление `results.entered` спортсменам с новым или изменённым местом. Аудит `results.update`.
- Соревнование ограничивается либо возрастными, либо академическими группами: оба списка → 422 `academic_group_ids`.

## Область `ratings`: рейтинг спортсменов

Публично, без входа. Рейтинг = дисциплина + возрастная **или** академическая группа. Места верифицированных соревнований за 365 дней, баллы складываются. Спортсмен стоит в группе, в которой он сейчас; баллы из младшей группы за год идут с ним. Равные баллы — одно место, дальше с пропуском: `1, 1, 1, 4`.

Строка `LineOut`: `{place, athlete: {id, full_name}, municipality: {id, name} | null, points, contests}`.
Блок `BoardOut`: `{discipline: {id, name}, group_kind: "age" | "academic", group: {id, name}, total, items: LineOut[]}`.

| Метод | Путь | Query | Ответ |
|---|---|---|---|
| GET | `/ratings` | `discipline_id?`, `municipality_id?`, `group_kind?=age\|academic` — только рейтинги по возрасту или по учёбе, `limit` (1–50, по умолчанию 10) | `{items: BoardOut[]}` — все непустые рейтинги сразу |
| GET | `/ratings/table` | `discipline_id`, `group_kind`, `group_id`, `municipality_id?`, `search?`, `limit` (до 200), `offset` | `BoardOut` с `total` по поиску; место при поиске не меняется. Нет дисциплины или группы → 404 |
| GET | `/ratings/athletes/{user_id}` | — | `{items: [{discipline, group_kind, group, place, total, points, contests, scores: [{contest: {id, title, ends_on}, place, points}]}]}` |

С фильтром `municipality_id` места пересчитываются внутри муниципалитета (`users.municipality_id`).

## Область `documents`: документы соревнования

ТЗ — [012_tz_results_rating_documents.md](012_tz_results_rating_documents.md). Виды `kind`: `certificate`, `diploma`, `gramota`, `thanks`, `reference`.

Тело формы `FormIn`: `{title (1–40), lead?, text? (до 400), recipients: participants|winners, places_to (1–100), signer_position?, signer_name?, issued_on?}` — дата по умолчанию сегодня по Оренбургу.

### Публично

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/contests/{id}/documents` | `{items: [{kind, kind_title, form, items: [{token, number, name, role, team, place}]}]}` — `name` как «Фамилия И. О.»; непубличный статус → 404 |
| GET | `/contests/{id}/documents/{kind}/pdf` | все документы вида одним PDF |
| GET | `/documents/{token}` | документ для страницы проверки: номер, вид, заголовок, текст, получатель, роль, команда, место, подопечные, соревнование, подписант; нет → 404 |
| GET | `/documents/{token}/pdf` | PDF документа |

### Организатор (`/organizer/...`, свои) и федерация (`/admin/...`, любые)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| PUT | `/contests/{id}/documents/{kind}` | `FormIn` | выпуск заменяет прежние документы вида; ответ как у публичного списка |
| DELETE | `/contests/{id}/documents/{kind}` | — | 204 |
| GET | `/contests/{id}/documents/{kind}/preview` | поля `FormIn` в query | PDF первой страницы, без сохранения |

- Статус не «Идёт», «Завершено», «В архиве» → 409 `invalid_status`; получателей нет → 422 `recipients`.
- Сохранение мест (`PUT …/results`) перевыпускает все выданные виды соревнования с прежним текстом.
- Аудит: `documents.issue`, `documents.remove`.

### Свои документы (сессия)

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/me/documents` | `{items: [{token, number, kind, kind_title, title, role, place, issued_on, contest: {id, title, dates}}], available: [{contest}]}` — `available`: соревнования «Идёт», «Завершено», «В архиве», где человек в одобренной заявке или подал её как тренер, и своей справки ещё нет |
| POST | `/me/documents/reference` | `{contest_id}` → выдаёт свою справку (вид `reference`) с текстом и подписантом уже выпущенных справок соревнования или по умолчанию; уже есть — отдаёт её; нельзя → 403 |

Подпись: у каждого документа HMAC-SHA256 от токена, номера, вида, получателя, соревнования и снимка данных; ключ `FSP_DOCUMENT_SIGNING_SECRET`. `GET /documents/{token}` отдаёт `valid`; при несовпадении страница проверки пишет, что документ недействителен.

## Разряды, судейские категории и коллегии

Полностью — [013_tz_judges_ranks.md](013_tz_judges_ranks.md).

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/me/qualifications` | — | `{items, submitted}`: свои и поданные за спортсменов |
| GET | `/me/athletes` | — | спортсмены из заявок тренера `[{id, name, birth_date}]` |
| POST | `/qualifications` | `{kind: judge_category\|rank, user_id?, item_id, document_file_id, basis?}` | 201 `Qualification`; 409 `already_pending`, `not_higher` |
| POST | `/qualifications/{id}/withdraw` | — | `Qualification` |
| GET | `/admin/qualifications` | `kind?`, `status?` (по умолчанию `pending`) | `[Qualification]` |
| GET | `/admin/qualifications/{id}/preview` | — | `{valid_until}` |
| POST | `/admin/qualifications/{id}/approve` | — | `Qualification` |
| POST | `/admin/qualifications/{id}/reject` | `{reason}` | `Qualification` |
| GET | `/contests/{id}/judges` | — | `{contest_id, starts_on, items: [{id, judge, position, category}]}` |
| GET | `/contests/{id}/judges/candidates` | `q?` | `[{judge, category}]`: `category = null` — нет действующей на дату |
| POST | `/contests/{id}/judges` | `{judge_id, position_id}` | 201 коллегия; 409 `category_not_valid`, `already_assigned` |
| PATCH | `/contests/{id}/judges/{assignment_id}` | `{position_id}` | коллегия |
| DELETE | `/contests/{id}/judges/{assignment_id}` | — | коллегия |
| GET | `/me/judge-assignments` | — | `[{id, contest, position}]` |

`Qualification`: `id, kind, kind_title, item_id, item_name, status, status_title, user, submitted_by, document_file_id, document_name, basis, reject_reason, valid_from, valid_until, decided_at, created_at`.

---

## Область `analytics`: аналитика федерации

Только федерация: остальным 403, без сессии 401. Только чтение, своих таблиц нет.

| Метод | Путь | Результат |
|---|---|---|
| GET | `/admin/analytics/{block}` | JSON блока |
| GET | `/admin/analytics/{block}.xlsx` | блок одним листом |
| GET | `/admin/analytics.xlsx` | книга: лист «Параметры» и по листу на блок |

Параметры у всех: `date_from`, `date_to` (`YYYY-MM-DD`, по умолчанию двенадцать месяцев с текущим), `discipline_id`, `municipality_id`, `group_kind=age|academic`, `group_id` (только вместе с `group_kind`). Обратный диапазон и период длиннее десяти лет — 422.

- Прошлый период — та же длина сразу перед текущим. `Delta = {value, previous, diff, pct}`, `pct = null`, если в прошлом был ноль.
- Участник — спортсмен в одобренной заявке, активный, не отказавшийся; соревнование не черновик и не отменено, считается по дате начала.
- Дисциплина фильтрует по соревнованию, муниципалитет — по участнику (у блока `contests` — по соревнованию), группа — по снимку в заявке.
- Каждый ответ: `block`, `title`, `period: {from, to}`, `previous: {from, to}` и поля блока:

| `block` | Поля |
|---|---|
| `summary` | `tiles`: `participants`, `newcomers`, `starts`, `contests`, `approval_rate`, `retention`, `qualifications` — всё `Delta` |
| `participants` | `months: [{month, label, participants, newcomers, starts}]`, `totals` |
| `contests` | `total`, `levels`, `formats`, `statuses`: `[{name, value, previous}]` |
| `applications` | `counts`: `approved`, `rejected`, `submitted`, `withdrawn`; `reasons: [{reason, count}]` (топ-10) |
| `retention` | `rate`, `kept`, `base`, `cohorts: [{month, label, size, m1, m3, m6}]` |
| `demographics` | `municipalities`, `ages`, `academic`: `[{name, value, previous}]` |
| `coaches` | `items: [{id, name, points, previous_points, athletes, starts, podiums}]` (топ-20 по баллам подопечных), `total_points` |
| `judges` | `items: [{id, name, category, contests, days, chief}]`, `judges`, `average`, `without_panel` |
| `qualifications` | `months: [{month, label, ranks, categories}]`, `by_name: [{kind, name, value}]`, `totals` |
| `disciplines` | `items: [{id, name, participants, newcomers, contests, applications, approved, points}]` — все `Delta` |

Файл: `analytics-{block}-{from}-{to}.xlsx` или `analytics-{from}-{to}.xlsx`, `Content-Disposition` в UTF-8. Числа — числами, доли — процентным форматом.

## Сборные

Полностью — [014_tz_squads.md](014_tz_squads.md).

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/squads` | `discipline_id?`, `group_kind?`, `group_id?` | `{items: [Squad]}`, без входа |
| GET | `/squads/members/{user_id}` | — | `{items: [{squad_id, title, discipline, group_kind, group, link}]}` — метки «Участник сборной …» |
| GET | `/admin/squads/candidates` | `discipline_id`, `group_kind`, `group_id`, `main_size`, `reserve_size` | `{title, discipline, group_kind, group, main_size, reserve_size, available, main, reserve, current}` |
| POST | `/admin/squads` | `{discipline_id, group_kind, group_id, main_size, reserve_size, order_number, order_date, order_file_id}` | 201 `{id, title, link, main, reserve}`; заменяет действующую сборную; 409 `no_candidates` |
| DELETE | `/admin/squads/{id}` | — | 204 |

`Squad`: `id, title, discipline, group_kind, group, main_size, reserve_size, order: {number, date, url, file_name}, approved_at, main, reserve`. Участник: `{position, athlete: {id, name}, municipality, points}`, ФИО полностью у всех.

## Документы судей, благодарности судьям, отчёт по человеку

Полностью — [015_tz_judge_documents_reports.md](015_tz_judge_documents_reports.md).

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/contests/{id}/judge-documents` | — | `[{id, kind, kind_title, judge_id, judge_name, position, removed, file_name, file_type, file_size, url, comment, created_at, updated_at}]` |
| POST | `/contests/{id}/judge-documents` | `{kind: note\|act\|protocol\|other, file_id, comment?}` | 201; 403 не в коллегии; 409 `invalid_status` |
| PATCH | `/judge-documents/{id}` | `{kind, file_id?, comment?}` | документ; 403 чужой или судья снят |
| DELETE | `/judge-documents/{id}` | — | 204 |
| PUT | `/{organizer\|admin}/contests/{id}/documents/judge_thanks` | `FormIn` + `judge_ids?: uuid[]` | `null` — вся коллегия |
| GET | `/people/{id}/report` | — | `{allowed, date_from, date_to}` |
| GET | `/people/{id}/report.pdf` | `from?`, `to?` | PDF; 403 нет доступа; 422 `from > to` |
| GET | `/people/{id}/report.xlsx` | `from?`, `to?` | xlsx |

Раздел «Рейтинг» (только спортсмену): дисциплина, группа с видом, место, из скольких, баллы, соревнований — на сегодня, окно 365 дней. Тренеру — «Рейтинг подопечных»: те же места по каждому подопечному из заявок периода.

`GET /people/{id}/wall?role=judge` — лента судьи, у записей поле `position`. Снятие судьи (`DELETE /contests/{id}/judges/{assignment_id}`) теперь мягкое.
