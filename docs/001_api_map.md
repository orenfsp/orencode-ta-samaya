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
3. Генерируется токен (32 байта urlsafe). В Redis кладётся `pwreset:{sha256(token)}:token` → `user_id` с TTL 1 час. Предыдущие токены этого пользователя не отзываем — каждый живёт свой час.
4. Ссылка `{FRONTEND_URL}/reset-password?token=...` пишется в лог приложения уровнем INFO (`docker logs fsp`). Когда подключим SMTP — она уйдёт письмом, контракт не изменится.
5. Аудит `auth.password_reset_requested` (только если пользователь найден).

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
7. Аудит `auth.password_reset`.
8. Пользователь не логинится автоматически — фронт отправляет его на страницу входа.

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
| GET | `/admin/contests/{id}/history` | `[{id, kind: status\|verification, from_value, to_value, comment, created_at, user}]` |
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
