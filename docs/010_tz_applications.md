# Мини-ТЗ: заявки на участие и команды (Ivan-005)

Второе звено главной цепочки: **соревнование → заявка → занятое место → рейтинг**. Правила — [000_conventions.md](000_conventions.md), соревнования — [007_tz_contests.md](007_tz_contests.md).

## Зачем

- Спортсмен записывается на соревнование сам. На командное — создаёт команду, становится капитаном и зовёт остальных.
- Тренер записывает подопечных: собирает личные заявки и команды. Сам в состав не входит. Связи «тренер ↔ спортсмен» пока нет, поэтому каждый спортсмен подтверждает участие сам.
- Организатор модерирует заявки на свои соревнования, федерация — на любые.
- В заявке на дату соревнования фиксируются возрастная и академическая группа каждого участника: по этому снимку потом считается рейтинг.

Не входит:
- согласие законного представителя для младше 18 — отдельная ветка;
- просьба вступить в чужую команду и публичный список собирающихся команд — позже, в карточке соревнования;
- уведомления — места вызова помечены «→ уведомление»;
- история статусов заявки — не храним, значимые действия пишутся в аудит.

---

## Академическая группа у человека

Возрастная группа считается из `users.birth_date` на дату начала соревнования. Академическая хранится у человека:

| Поле | Тип | Описание |
|---|---|---|
| `users.academic_group_id` | int null → `dictionary_academic_groups` | класс или «Студенты»; меняет сам человек |

`PATCH /me` с `academic_group_id` — только активное значение справочника. Без академической группы нельзя подать заявку, позвать человека в команду и подтвердить участие: ошибка у поля с подсказкой, кому заполнить.

---

## Модели

### `infrastructure/contest_application.py` — `ContestApplicationModel`, таблица `contest_applications`

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `contest_id` | int → `contests` (CASCADE) | |
| `team_name` | str(100) null | только у командных, обязательно там |
| `created_by` | uuid → `users` | кто создал |
| `created_as` | enum `ApplicationCreator`: `athlete` / `coach` | от чьего лица |
| `status` | enum `ApplicationStatus` | см. ниже |
| `reject_reason` | text null | |
| `decided_by`, `decided_at` | uuid null, timestamptz null | последнее решение организатора или федерации |
| `submitted_at` | timestamptz null | когда подана на рассмотрение |
| `created_at`, `updated_at` | timestamptz | |

Уникально: `(contest_id, lower(team_name))` среди заявок не в статусе `withdrawn`.

### `infrastructure/contest_application_member.py` — `ContestApplicationMemberModel`, таблица `contest_application_members`

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `application_id` | int → `contest_applications` (CASCADE) | |
| `contest_id` | int → `contests` (CASCADE) | копия из заявки — для запрета дублей |
| `user_id` | uuid → `users` | |
| `is_captain` | bool | у командной заявки от спортсмена — создатель |
| `confirmation` | enum `MemberConfirmation`: `invited` / `confirmed` / `declined` | |
| `is_active` | bool | участник не отказался и заявка не отозвана и не отклонена |
| `age_group_id` | int null → `dictionary_age_groups` | снимок при подаче |
| `academic_group_id` | int null → `dictionary_academic_groups` | снимок при подаче |
| `created_at`, `responded_at` | timestamptz | |

Частичный уникальный индекс `(contest_id, user_id) WHERE is_active`: один человек — одна действующая заявка на соревнование.

### Перечисления

| Enum | Значения |
|---|---|
| `ApplicationStatus` | `forming` — собирается состав · `submitted` — на рассмотрении · `approved` · `rejected` · `withdrawn` |
| `ApplicationCreator` | `athlete`, `coach` |
| `MemberConfirmation` | `invited`, `confirmed`, `declined` |

---

## Жизненный цикл

```
forming ──подать──▶ submitted ──одобрить──▶ approved
   ▲                  │  ▲                      │
   └── правка состава ┘  └── вернуть ◀── rejected
любой, кроме rejected ──отозвать──▶ withdrawn
```

- **Личная от спортсмена:** создаётся сразу `submitted`.
- **Личная от тренера:** `forming`, спортсмен приглашён. Подтвердил — заявка сама уходит в `submitted`. Отказался — заявка `withdrawn`.
- **Командная:** `forming`. Капитан (или тренер-создатель) подаёт, когда все участники подтвердили и их число в пределах `team_size_min…team_size_max`. Приглашённые, но не ответившие, мешают подаче.
- **Правка состава** (пригласить, убрать, отказ участника) в `submitted` или `approved` возвращает заявку в `forming`.
- **Модерация:** `submitted → approved`, `submitted → rejected` с причиной, `approved / rejected → submitted` («вернуть на рассмотрение»).
- **Отзыв:** создатель или капитан — до начала соревнования.

### Когда что можно

| Действие | Статус соревнования |
|---|---|
| создать, пригласить, убрать, подтвердить, подать, переименовать | `registration_open` и сейчас внутри окна `registration_opens_at…registration_closes_at` |
| отказаться, отозвать | до `in_progress` |
| модерировать | `registration_open`, `registration_closed` |

### Проверки участника

На создании и приглашении — для приглашаемого, на подтверждении — для себя, на подаче — для всех:
1. у человека подтверждена роль `athlete`;
2. заполнена академическая группа;
3. если у соревнования есть возрастные группы — возраст на `starts_on` попадает хотя бы в одну;
4. если есть академические группы — группа человека среди них;
5. нет другой действующей заявки на это соревнование.

При подаче в участников пишется снимок: возрастная группа (из групп соревнования, если они заданы, иначе из всего справочника) и академическая.

---

## Область `backend/applications/`

### Репозитории
- `pg_applications.py` — `ApplicationRepository`: заявки, списки с фильтрами, блокировка, сводка по соревнованиям.
- `pg_application_members.py` — `ApplicationMemberRepository`: участники, поиск действующей заявки человека.

### Домен
- `domain/eligibility.py` — `Eligibility`: чистые проверки без БД — возраст на дату, попадание в группы, размер команды. Те же проверки понадобятся при вводе мест.
- `domain/applications.py` — `Applications`: создание, состав, приглашения, подача, отзыв, модерация, списки.

### Фичи
- `features/participant/` — спортсмен и тренер;
- `features/organizer/` — модерация своих соревнований;
- `features/admin/` — модерация любых;
- `features/public/` — участники соревнования.

`Contest.delete` — нельзя удалить соревнование с заявками: 409 `has_applications`, только отменить.

---

## Эндпоинты

### Профиль (`auth/features/me`)
| Метод | Путь | Что |
|---|---|---|
| PATCH | `/me` | `{academic_group_id}` |

`MeOut` дополняется `academic_group: {id, name} \| null`.

### Спортсмен и тренер (`features/participant/`, роль `athlete` или `coach`)
| Метод | Путь | Что |
|---|---|---|
| GET | `/athletes/search?q=&contest_id=` | часть ФИО или email, слова в любом порядке, от 2 символов, до 20 человек. Email в ответе не отдаётся. Отдаёт ФИО, **дату рождения**, академическую группу; с `contest_id` — проходит ли человек и почему нет |
| GET | `/me/available-contests?as=athlete\|coach` | соревнования с открытой регистрацией. Спортсмену — куда он ещё не заявлен, с причиной, если не проходит; тренеру — все |
| GET | `/me/applications?as=athlete\|coach` | мои заявки: как участник (с приглашениями) или как тренер |
| POST | `/contests/{id}/applications` | `{as, team_name?, member_ids[], captain_id?}` |
| POST | `/contests/{id}/applications/batch` | тренер, личное соревнование: `{member_ids[]}` — по заявке на каждого, всё или ничего. Командных тренер собирает сколько угодно, по одной |
| GET | `/applications/{id}` | участникам, создателю, организатору соревнования, федерации |
| PATCH | `/applications/{id}` | `{team_name}` |
| POST | `/applications/{id}/members` | `{user_id}` — пригласить |
| DELETE | `/applications/{id}/members/{user_id}` | убрать |
| POST | `/applications/{id}/submit` · `/withdraw` | подать · отозвать |
| POST | `/applications/{id}/confirm` · `/decline` | ответ участника на приглашение; `decline` после подтверждения — выйти из команды |

### Организатор (`features/organizer/`, только свои) и федерация (`features/admin/`, любые)
| Метод | Путь | Что |
|---|---|---|
| GET | `/organizer/applications/contests` | соревнования с заявками и счётчиками по статусам — группировка раздела |
| GET | `/organizer/contests/{id}/applications?status=&search=` | заявки соревнования |
| POST | `/organizer/applications/{id}/approve` · `/reject` `{reason}` · `/reset` | решение по одной |
| POST | `/organizer/applications/approve` `{ids[]}` · `/reject` `{ids[], reason}` | по нескольким, всё или ничего |

У федерации те же пути под `/admin/...`.

### Публично (`features/public/`)
| Метод | Путь | Что |
|---|---|---|
| GET | `/contests/{id}/participants` | одобренные: команды с составом или личные участники, только ФИО |

### Аудит
`application.create`, `application.update`, `application.member_add`, `application.member_remove`, `application.confirm`, `application.decline`, `application.submit`, `application.withdraw`, `application.approve`, `application.reject`, `application.reset`, `profile.update`.

---

## Кабинеты (фронт — после бэка)

| Роль | Раздел | Что |
|---|---|---|
| Спортсмен | «Мои соревнования» | свои заявки и приглашения; у командных — состав, подтверждение; «Записаться» — доступные соревнования |
| Тренер | «Мои соревнования» | заявки за подопечных, сбор состава |
| Организатор | «Модерация участников» | свои соревнования с заявками → модерация |
| Федерация | «Модерация участников» | после «Соревнований»; соревнования с заявками → модерация |

Везде переход в карточку соревнования и календарь сбоку.

---

## Демо-данные `manage/demo_applications.py`

- академические группы у демо-спортсменов;
- `registration_open` личное: одобренная заявка `athlete@`, на рассмотрении — `athlete.coach@`;
- командное с открытой регистрацией: команда `athlete@` (капитан) в `forming` с приглашением, команда тренера `coach@` в `submitted`.

## Готово, когда

Спортсмен записывается сам и с командой, тренер записывает подопечных, организатор и федерация одобряют и отклоняют; неподходящий по возрасту или группе и второй раз заявленный получают понятную ошибку.
