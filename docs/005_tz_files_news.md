# Мини-ТЗ: файлы (MinIO) и новости

Параллельная ветка второго бэкендера. Основная логика (справочники, соревнования и т. д.) в этой ветке не трогается.
Перед началом прочитать [000_conventions.md](000_conventions.md) и [001_api_map.md](001_api_map.md) (раздел «Общее»).

Это общий фронт работы, а не исчерпывающая спецификация. Сделано: поиск, пагинация, архив вместо удаления, фронт ленты, статьи и редакции. Итоговый контракт — [001_api_map.md](001_api_map.md), раздел «Новости».

Готовое, на что опираемся: авторизация, `CurrentUserDep`, `require_role(Role.FEDERATION)`, `OptionalUserDep`, аудит, единый формат ошибок.

---

## Часть 1. Файлы

> **Сделано в Ivan-003** (см. [001_api_map.md](001_api_map.md), раздел «Файлы»). Вместо MinIO — SeaweedFS (S3 API): community-MinIO больше не распространяется. Новостям остаётся использовать доменный класс `Files` (`usable`, `set_public`) так же, как соревнования.

### Инфраструктура
- MinIO внутри того же контейнера: бинарь `minio` скачивается в `manage/Dockerfile`, стартует в `manage/entrypoint.sh` до запуска API, данные во временной папке (сбрасываются с контейнером). Порт MinIO пробрасывается наружу (`manage/fsp.py`, `-p 9000:9000`), чтобы браузер забирал файлы напрямую.
- Два бакета, создаются в `manage/bootstrap.py`:
  - `fsp-public` — анонимное чтение; файл доступен по постоянной ссылке `{minio_public_url}/fsp-public/{object_key}`;
  - `fsp-private` — закрытый; файл отдаётся только через API по временной подписанной ссылке.
- Любой загруженный файл сначала попадает в `fsp-private`. В `fsp-public` его переносит домен-владелец, когда контент становится публичным (публикация статьи), и возвращает обратно, когда перестаёт (снятие с публикации).
- Настройки в `core/config.py`: `minio_endpoint`, `minio_public_url`, `minio_access_key`, `minio_secret_key`, `minio_public_bucket`, `minio_private_bucket`, `file_max_size_mb = 10`, `file_allowed_types` (jpeg, png, webp, pdf, docx, xlsx, zip), `file_signed_url_ttl_seconds = 300`.
- Зависимости: `minio`, `python-multipart`. Клиент `minio` синхронный — вызовы оборачивать в `asyncio.to_thread`.

### Модель `infrastructure/services/file.py` — `FileModel`
| Поле | Тип |
|---|---|
| id | uuid |
| object_key | str, ключ в бакете (`{uuid}/{безопасное имя}`) |
| is_public | bool — в каком бакете лежит сейчас |
| original_name | str |
| content_type | str |
| size | int, байты |
| uploaded_by | uuid fk users |
| created_at | timestamptz |

### Область `backend/files/`
- `repositories/pg_files.py`; `repositories/s3_files.py` — put, перенос между бакетами, подписанная ссылка, delete.
- `domain/files.py` — `FileService`: `upload`, `url_for(file)` (публичная ссылка или `null`), `signed_url(file_id, user)`, `publish(file_ids)`, `unpublish(file_ids)`, `delete(file_ids)`. Другие области (новости, потом соревнования и заявки) работают с файлами только через него.

### Эндпоинты
| Метод | Путь | Доступ | Что делает |
|---|---|---|---|
| POST | `/files` | сессия | multipart `file`; проверка размера и типа (по content-type и сигнатуре); кладёт в `fsp-private`; 201 `{id, original_name, content_type, size}` |
| GET | `/files/{id}` | см. ниже | публичный файл — 307 на постоянную ссылку; приватный — проверка прав и 307 на подписанную ссылку на 5 минут |

Приватный файл может получить загрузивший или федерация, остальным 404 (не раскрываем существование).
В ответах других областей у файла всегда есть `id` и `url`: для публичного — постоянная ссылка, для приватного — `/api/v1/files/{id}`.
Ошибки: 413 `file_too_large`, 415 `unsupported_file_type` — новые классы в `core/errors.py`.
Аудит: `file.upload`.

---

## Часть 2. Новости

### Модели
`infrastructure/content/news_article.py` — `NewsArticleModel`:
| Поле | Тип |
|---|---|
| id | uuid |
| slug | str unique, генерируется из заголовка транслитом + суффикс при совпадении |
| title | str(200) |
| section | str(100) null — раздел/рубрика |
| summary | str(500) null — анонс для ленты |
| cover_file_id | uuid fk files null |
| blocks | jsonb — список блоков в порядке показа, хранится прямо в строке статьи |
| status | `draft` / `published` / `archived` |
| published_at | timestamptz null |
| views | int default 0 |
| author_id | uuid fk users |
| created_at, updated_at | timestamptz |

Хэштеги хранятся в самой статье: `news_articles.hashtags` — массив строк в нижнем регистре, без повторов, по алфавиту. Фильтр по тегу — `hashtags @> {tag}`, список тегов с числом статей — `unnest` по опубликованным.

### Блоки статьи (конструктор)
Валидируются в схемах фичи через discriminated union по полю `type`:
| type | Поля |
|---|---|
| `heading` | `text`, `level` 2–3 |
| `text` | `text` (простой текст с абзацами, без HTML) |
| `image` | `file_id`, `caption?` |
| `file` | `file_id`, `title` — файл для скачивания |
| `link` | `url` (http/https), `title` |

В блоке хранится только `file_id`; фронт открывает файл по `/api/v1/files/{file_id}`.
Лимиты: до 100 блоков, текст блока до 20 000 символов. Все `file_id` должны существовать.

### Эндпоинты для федерации (`require_role(Role.FEDERATION)`)
| Метод | Путь | Что делает |
|---|---|---|
| GET | `/admin/news?status=&tag=&limit=&offset=` | все статьи, включая черновики |
| GET | `/admin/news/{id}` | статья целиком |
| POST | `/admin/news` | создать черновик: `title, section?, summary?, cover_file_id?, blocks, hashtags[]` |
| PATCH | `/admin/news/{id}` | частичное изменение тех же полей; можно править и опубликованную |
| POST | `/admin/news/{id}/publish` | `draft → published`, ставит `published_at`, переносит обложку и файлы блоков в публичный бакет (`FileService.publish`) |
| POST | `/admin/news/{id}/unpublish` | `published → draft`, файлы обратно в приватный бакет |
| POST | `/admin/news/{id}/archive` | архивирует, закрывает файлы, сохраняет статью и вложения |
| POST | `/admin/news/{id}/restore` | восстанавливает архив в черновик |

Хэштеги: строки без `#`, 2–50 символов, приводятся к lower, до 10 на статью; несуществующие создаются.
Аудит: `news.create`, `news.update`, `news.publish`, `news.unpublish`, `news.archive`, `news.restore`. Физического удаления нет. Первая дата публикации сохраняется.

### Публичные эндпоинты (без входа)
| Метод | Путь | Что делает |
|---|---|---|
| GET | `/news?q=&tag=&section=&limit=&offset=` | только опубликованные, поиск по заголовку и анонсу, по `published_at` desc; ответ `{items, total}` |
| GET | `/news/{slug}` | статья целиком; черновик → 404; засчитывает просмотр |
| GET | `/news/tags` | хэштеги опубликованных статей с количеством, по убыванию |

### Просмотры
- Посетитель = `user_id`, если вошёл; иначе `sha256(ip + user-agent)`.
- Redis: `SET news:{article_id}:{visitor}:cooldown 1 NX EX 86400`. Если ключ поставился — `UPDATE news_articles SET views = views + 1`. Если уже был — не считаем.
- Репозиторий `repositories/red_news_views.py`.

### Демо-данные
`manage/seed/seed.sql`: 4–5 статей (3 опубликованы, 1–2 черновика), 5–6 хэштегов, разные типы блоков. Картинки можно без файлов (блоки `text`, `heading`, `link`), либо загрузить пару заглушек в MinIO при сиде.

---

## Готово, когда
- Федерация создаёт черновик из блоков с картинкой и файлом, публикует — статья видна в `/news` без входа, файлы скачиваются без входа.
- Черновики и их файлы не видны анонимам (404); после публикации файлы лежат в `fsp-public` и открываются по постоянной ссылке, после снятия — снова только через API.
- Повторное открытие статьи тем же посетителем в течение суток не увеличивает `views`.
- Фильтр по тегу работает, `/news/tags` считает только опубликованные.
- Не-федерация на `/admin/news*` получает 403, аноним — 401.
- Разделы «Файлы» и «Новости» добавлены в `docs/001_api_map.md` в формате остальных блоков.
- pyright — 0 ошибок, контейнер собирается `python manage/fsp.py`.

## Доработка (Andrey-5)
- Адрес статьи — транслит заголовка; суффикс `-a1b2c3` добавляется только при совпадении, как в ТЗ.
- `GET /news/{slug}` возвращает `views` уже с засчитанным просмотром.
- В журнале действий статьи видны как объект «Статья» (`news_article`) со ссылкой на редактор.
