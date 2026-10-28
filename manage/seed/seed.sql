-- Демо-база ФСП Оренбургской области.
--
-- Заливается при каждом старте контейнера в пустую схему (manage/bootstrap.py), поэтому после
-- перезапуска база всегда в одном и том же чистом тестовом состоянии.
--
-- Правила файла:
--   * все даты считаются от current_date, поэтому «регистрация открыта» и «ближайшие соревнования»
--     остаются правдой в любой день;
--   * ссылки между таблицами — по почте, названию или коду, без захардкоженных id;
--   * файлы (аватары, положения, приказы, согласия) лежат рядом, в manage/seed/<тип>/…,
--     а object_key в таблице files — это путь к файлу относительно manage/seed. Загружает их bootstrap;
--   * дипломы, сертификаты и справки не хранятся файлами: bootstrap выпускает их кодом приложения
--     по списку из временной таблицы seed_documents (раздел 14), чтобы номер и подпись были настоящими.
--
-- Пароль всех аккаунтов — Demo1234.


-- ============================================================================
-- 0. Вспомогательные функции. Живут во временной схеме и исчезают после заливки
-- ============================================================================

-- id пользователя по почте; опечатка в почте сразу роняет заливку
create function pg_temp.user_id(address text) returns uuid language plpgsql as $$
declare found uuid;
begin
  select id into found from users where email = address;
  if found is null then raise exception 'seed: нет пользователя %', address; end if;
  return found;
end $$;

-- id записи справочника по названию: pg_temp.dict('dictionary_disciplines', 'Квизы')
create function pg_temp.dict(tbl text, item text) returns integer language plpgsql as $$
declare found integer;
begin
  execute format('select id from %I where name = $1', tbl) into found using item;
  if found is null then raise exception 'seed: нет «%» в %', item, tbl; end if;
  return found;
end $$;

-- Момент «через days дней в hh:mm по Оренбургу»
create function pg_temp.at(days integer, hh integer default 12, mm integer default 0) returns timestamptz
language sql as $$
  select ((current_date + days) + make_time(hh, mm, 0)) at time zone 'Asia/Yekaterinburg'
$$;

-- Полных лет на дату
create function pg_temp.age_on(birth date, on_date date) returns integer language sql as $$
  select extract(year from age(on_date, birth))::integer
$$;

-- Возрастная группа участника на дату старта: из групп соревнования, а если их нет — из справочника.
-- Повторяет Eligibility.age_group
create function pg_temp.age_group(birth date, contest integer) returns integer language sql as $$
  with c as (select starts_on from contests where id = contest),
       own as (select g.* from dictionary_age_groups g join contest_age_groups l on l.age_group_id = g.id
               where l.contest_id = contest),
       pool as (select * from own union all
                select * from dictionary_age_groups where not exists (select 1 from own))
  select pool.id from pool, c
  where (pool.min_age is null or pg_temp.age_on(birth, c.starts_on) >= pool.min_age)
    and (pool.max_age is null or pg_temp.age_on(birth, c.starts_on) <= pool.max_age)
  order by pool.id limit 1
$$;

-- Файл из manage/seed: путь, видимость, владелец
create function pg_temp.file(path text, public boolean, owner text) returns uuid language sql as $$
  insert into files (id, object_key, is_public, original_name, content_type, size, uploaded_by)
  values (gen_random_uuid(), path, public, regexp_replace(path, '^.*/', ''),
          case when path like '%.pdf' then 'application/pdf' else 'image/jpeg' end,
          0, pg_temp.user_id(owner))
  returning id
$$;


-- ============================================================================
-- 1. Справочники
-- ============================================================================

insert into dictionary_disciplines (name, description, is_archived) values
  ('Алгоритмическое программирование', 'Решение алгоритмических задач на время, индивидуально и в командах', false),
  ('Продуктовое программирование', 'Командная разработка программного продукта по кейсу с защитой', false),
  ('Программирование систем информационной безопасности', 'Соревнования в формате CTF', false),
  ('Программирование систем искусственного интеллекта', 'Задачи машинного обучения и анализа данных', false),
  ('Программирование робототехники', 'Программирование роботов для выполнения заданий на полигоне', false),
  ('Программирование беспилотных авиационных систем', 'Программирование автономных полётов БПЛА', false),
  ('Квизы', 'Командные интеллектуальные игры по ИТ-тематике', false),
  ('Олимпиадное программирование', 'Старое название алгоритмического программирования', true);

insert into dictionary_municipalities (name)
select unnest(array[
  'г. Оренбург', 'г. Орск', 'г. Новотроицк', 'г. Бузулук', 'г. Бугуруслан', 'г. Медногорск', 'ЗАТО п. Комаровский',
  'Абдулинский городской округ', 'Гайский городской округ', 'Кувандыкский городской округ',
  'Соль-Илецкий городской округ', 'Сорочинский городской округ', 'Ясненский городской округ',
  'Адамовский район', 'Акбулакский район', 'Александровский район', 'Асекеевский район', 'Беляевский район',
  'Бугурусланский район', 'Бузулукский район', 'Грачёвский район', 'Домбаровский район', 'Илекский район',
  'Кваркенский район', 'Красногвардейский район', 'Курманаевский район', 'Матвеевский район', 'Новоорский район',
  'Новосергиевский район', 'Октябрьский район', 'Оренбургский район', 'Первомайский район', 'Переволоцкий район',
  'Пономарёвский район', 'Сакмарский район', 'Саракташский район', 'Светлинский район', 'Северный район',
  'Ташлинский район', 'Тоцкий район', 'Тюльганский район', 'Шарлыкский район']);

insert into dictionary_organization_types (name, description) values
  ('Общеобразовательная школа', null),
  ('Лицей / гимназия', null),
  ('Колледж / техникум', 'Среднее профессиональное образование'),
  ('Вуз', null),
  ('Спортивная школа', null),
  ('Спортивный клуб', null),
  ('Компания', 'Коммерческая организация, в т. ч. организатор соревнований'),
  ('Без организации', 'Спортсмен занимается самостоятельно');

insert into dictionary_academic_groups (name)
select unnest(array['1–4 классы', '5–9 классы', '10–11 классы', 'Студенты']);

insert into dictionary_age_groups (name, min_age, max_age) values
  ('До 14 лет', null, 13),
  ('14–17 лет', 14, 17),
  ('18 лет и старше', 18, null);

insert into dictionary_contest_types (name, description) values
  ('Чемпионат', 'Без ограничения по возрасту'),
  ('Первенство', 'Для определённых возрастных групп'),
  ('Кубок', null),
  ('Турнир', null),
  ('Фестиваль', null);

insert into dictionary_contest_levels (name, description) values
  ('Региональное', 'Чемпионаты и первенства области и иные региональные'),
  ('Межрегиональное', 'В том числе окружные (ПФО)'),
  ('Всероссийское', 'Чемпионаты, первенства и кубки России'),
  ('Международное', null);

insert into dictionary_contest_formats (name, description) values
  ('Очно', null),
  ('Онлайн', null),
  ('Смешанный', 'Например, разработка онлайн, защита проектов очно');

-- Звания бессрочные; юношеские разряды действуют не дольше 18 лет
insert into dictionary_rank_types (name, rank_kind, min_age, validity_months, is_lifetime, valid_until_age) values
  ('Заслуженный мастер спорта России', 'Спортивное звание', null, null, true, null),
  ('Мастер спорта России международного класса', 'Спортивное звание', null, null, true, null),
  ('Мастер спорта России', 'Спортивное звание', 16, null, true, null),
  ('Кандидат в мастера спорта', 'Спортивный разряд', 15, 36, false, null),
  ('Первый спортивный разряд', 'Спортивный разряд', 14, 24, false, null),
  ('Второй спортивный разряд', 'Спортивный разряд', 14, 24, false, null),
  ('Третий спортивный разряд', 'Спортивный разряд', 14, 24, false, null),
  ('Первый юношеский спортивный разряд', 'Юношеский разряд', 12, 24, false, 18),
  ('Второй юношеский спортивный разряд', 'Юношеский разряд', 12, 24, false, 18),
  ('Третий юношеский спортивный разряд', 'Юношеский разряд', 12, 24, false, 18);

insert into dictionary_judge_categories (name, validity_months, is_archived) values
  ('Спортивный судья всероссийской категории', 48, false),
  ('Спортивный судья первой категории', 48, false),
  ('Спортивный судья второй категории', 24, false),
  ('Спортивный судья третьей категории', 24, false),
  ('Юный спортивный судья', null, true);

insert into dictionary_judge_positions (name)
select unnest(array['Главный судья', 'Заместитель главного судьи', 'Главный секретарь',
                    'Заместитель главного секретаря', 'Судья']);


-- ============================================================================
-- 2. Аккаунты и роли
-- ============================================================================

-- ord — номер спортсмена «по категориям»: история для аналитики (раздел 7) берёт их по порядку
create temp table seed_people (
  email text primary key, last_name text, first_name text, middle_name text, birth_date date,
  academic_group text, roles text[], ord integer
);

-- Роли: «роль» — подтверждена, «роль?» — на проверке, «роль!» — отказано
insert into seed_people values
  -- Сотрудники федерации и организаторы
  ('federation@example.test',        'Федеральцев',    'Олег',     'Викторович',  '1980-04-12', null, '{federation}', null),
  ('minister@example.test',          'Министров',      'Пётр',     'Сергеевич',   '1975-09-03', null, '{federation}', null),
  ('organizer@example.test',         'Организаторова', 'Елена',    'Павловна',    '1988-01-20', null, '{organizer}', null),
  ('organizer.pending@example.test', 'Петрова',        'Анна',     'Сергеевна',   '1990-07-15', null, '{organizer?}', null),
  -- Тренеры и судьи
  ('coach@example.test',             'Тренеров',       'Игорь',    'Николаевич',  '1985-11-02', null, '{coach}', null),
  ('coach.unverified@example.test',  'Новиков',        'Денис',    null,          '1995-02-27', null, '{coach?}', null),
  ('judge@example.test',             'Орлов',          'Павел',    'Дмитриевич',  '1983-06-09', null, '{judge}', null),
  ('judge.pending@example.test',     'Лебедев',        'Максим',   'Андреевич',   '1991-04-22', null, '{judge?}', null),
  ('judge.rejected@example.test',    'Зайцев',         'Роман',    'Олегович',    '1992-12-30', null, '{judge!}', null),
  ('athlete.coach@example.test',     'Кузнецов',       'Илья',     'Петрович',    '2001-08-14', 'Студенты', '{athlete,coach}', null),
  ('coach.judge@example.test',       'Зайцева',        'Ольга',    'Михайловна',  '1979-10-05', null, '{coach,judge}', null),
  -- Спортсмены основных сценариев
  ('athlete@example.test',           'Соколов',        'Артём',    'Игоревич',    '2006-03-01', 'Студенты', '{athlete}', null),
  ('athlete.second@example.test',    'Морозова',       'Дарья',    'Ильинична',   '2009-09-01', '10–11 классы', '{athlete}', null),
  ('athlete.third@example.test',     'Гусев',          'Тимур',    'Ринатович',   '2005-02-11', 'Студенты', '{athlete}', null),
  ('pupil1@example.test',            'Ковалёв',        'Никита',   'Сергеевич',   '2010-02-14', '10–11 классы', '{athlete}', null),
  ('pupil2@example.test',            'Фёдорова',       'Алиса',    'Романовна',   '2011-07-03', '5–9 классы', '{athlete}', null),
  ('pupil3@example.test',            'Ахмедов',        'Руслан',   'Тимурович',   '2009-12-20', '10–11 классы', '{athlete}', null),
  ('athlete.minor@example.test',     'Белова',         'Мария',    'Андреевна',   '2012-05-18', '5–9 классы', '{athlete}', null),
  -- Спортсмены на каждое сочетание «возраст × академическая группа». Почта — категория и номер
  ('u14-1-4.1@example.test',         'Смирнов',        'Матвей',   'Алексеевич',  '2016-04-09', '1–4 классы', '{athlete}', 1),
  ('u14-1-4.2@example.test',         'Попова',         'Ева',      'Дмитриевна',  '2017-01-23', '1–4 классы', '{athlete}', 2),
  ('u14-1-4.3@example.test',         'Васильев',       'Лев',      'Андреевич',   '2016-10-02', '1–4 классы', '{athlete}', 3),
  ('u14-1-4.4@example.test',         'Новикова',       'Мила',     'Сергеевна',   '2018-03-15', '1–4 классы', '{athlete}', 4),
  ('u14-5-9.1@example.test',         'Петров',         'Тимофей',  'Олегович',    '2013-06-11', '5–9 классы', '{athlete}', 5),
  ('u14-5-9.2@example.test',         'Козлова',        'Варвара',  'Ильинична',   '2014-02-27', '5–9 классы', '{athlete}', 6),
  ('u14-5-9.3@example.test',         'Лебедев',        'Арсений',  'Павлович',    '2013-12-05', '5–9 классы', '{athlete}', 7),
  ('u14-5-9.4@example.test',         'Орлова',         'Злата',    'Викторовна',  '2014-08-19', '5–9 классы', '{athlete}', 8),
  ('14-17-5-9.1@example.test',       'Соловьёв',       'Максим',   'Романович',   '2012-01-14', '5–9 классы', '{athlete}', 9),
  ('14-17-5-9.2@example.test',       'Медведева',      'Полина',   'Артёмовна',   '2011-05-30', '5–9 классы', '{athlete}', 10),
  ('14-17-5-9.3@example.test',       'Волков',         'Егор',     'Денисович',   '2011-09-08', '5–9 классы', '{athlete}', 11),
  ('14-17-5-9.4@example.test',       'Зайцева',        'Ксения',   'Игоревна',    '2012-03-03', '5–9 классы', '{athlete}', 12),
  ('14-17-10-11.1@example.test',     'Павлов',         'Даниил',   'Евгеньевич',  '2010-04-21', '10–11 классы', '{athlete}', 13),
  ('14-17-10-11.2@example.test',     'Семёнова',       'Анастасия','Максимовна',  '2009-11-01', '10–11 классы', '{athlete}', 14),
  ('14-17-10-11.3@example.test',     'Голубев',        'Кирилл',   'Антонович',   '2010-07-16', '10–11 классы', '{athlete}', 15),
  ('14-17-10-11.4@example.test',     'Виноградова',    'София',    'Николаевна',  '2009-12-28', '10–11 классы', '{athlete}', 16),
  ('14-17-10-11.5@example.test',     'Богданов',       'Роман',    'Ильич',       '2010-02-09', '10–11 классы', '{athlete}', 17),
  ('14-17-10-11.6@example.test',     'Тарасова',       'Вероника', 'Олеговна',    '2009-06-13', '10–11 классы', '{athlete}', 18),
  ('14-17-stud.1@example.test',      'Фролов',         'Глеб',     'Сергеевич',   '2009-03-07', 'Студенты', '{athlete}', 19),
  ('14-17-stud.2@example.test',      'Киселёва',       'Алина',    'Дмитриевна',  '2009-08-24', 'Студенты', '{athlete}', 20),
  ('18-stud.1@example.test',         'Макаров',        'Владислав','Андреевич',   '2006-05-12', 'Студенты', '{athlete}', 21),
  ('18-stud.2@example.test',         'Андреева',       'Екатерина','Павловна',    '2005-10-03', 'Студенты', '{athlete}', 22),
  ('18-stud.3@example.test',         'Никитин',        'Иван',     'Алексеевич',  '2004-01-29', 'Студенты', '{athlete}', 23),
  ('18-stud.4@example.test',         'Захарова',       'Ульяна',   'Романовна',   '2007-07-18', 'Студенты', '{athlete}', 24),
  ('18-stud.5@example.test',         'Сорокин',        'Михаил',   'Викторович',  '2003-04-06', 'Студенты', '{athlete}', 25),
  ('18-stud.6@example.test',         'Белоусова',      'Дарина',   'Евгеньевна',  '2008-02-02', 'Студенты', '{athlete}', 26),
  -- Исполнилось 18 в одиннадцатом классе
  ('18-10-11.1@example.test',        'Комаров',        'Святослав','Игоревич',    '2008-01-17', '10–11 классы', '{athlete}', 27),
  -- Без академической группы: заявку с ними не принять
  ('nogroup.1@example.test',         'Ершов',          'Платон',   'Денисович',   '2010-09-09', null, '{athlete}', 28),
  ('nogroup.2@example.test',         'Крылова',        'Таисия',   'Максимовна',  '2005-12-12', null, '{athlete}', 29);

-- Муниципалитеты раздаются по кругу в порядке почты
insert into users (id, email, password_hash, last_name, first_name, middle_name, birth_date,
                   pd_consent_version, pd_consent_at, email_verified_at, academic_group_id, municipality_id)
select gen_random_uuid(), p.email,
       '$argon2id$v=19$m=65536,t=3,p=4$lXdHci8JJPgTcaFSoHy45Q$QAohNTkT/BOI9SL69YA0IWLVPi8czLRddANCAnN3atk',
       p.last_name, p.first_name, p.middle_name, p.birth_date, '1.0', now(), now(),
       case when p.academic_group is not null then pg_temp.dict('dictionary_academic_groups', p.academic_group) end,
       pg_temp.dict('dictionary_municipalities', (array['г. Оренбург', 'г. Оренбург', 'г. Орск', 'г. Новотроицк',
         'г. Бузулук', 'Оренбургский район'])[(row_number() over (order by p.email) - 1) % 6 + 1])
from seed_people p;

-- Спортсмена подтверждать не нужно; остальные роли решает Федеральцев
insert into user_roles (id, user_id, role, status, reject_reason, decided_by, decided_at)
select gen_random_uuid(), pg_temp.user_id(p.email), rtrim(r, '?!')::role, s.status::role_status,
       case when s.status = 'rejected' then 'Не приложен документ о судейской квалификации' end,
       case when s.status <> 'pending' and r <> 'athlete' then pg_temp.user_id('federation@example.test') end,
       case when s.status <> 'pending' and r <> 'athlete' then now() end
from seed_people p, unnest(p.roles) r,
     lateral (select case right(r, 1) when '?' then 'pending' when '!' then 'rejected' else 'verified' end as status) s;

-- Реальные публичные хэндлы: воркер подтянет живой рейтинг при старте. Последнего не существует
update users u set codeforces_handle = h.handle, codeforces_status = 'pending'
from (values ('athlete@example.test', 'tourist'), ('coach@example.test', 'Petr'), ('judge@example.test', 'Um_nik'),
             ('organizer@example.test', 'jiangly'), ('athlete.coach@example.test', 'fsp_no_such_handle_56')) h(email, handle)
where u.email = h.email;

-- Нейропортрет у каждого: avatars/<почта до @>.jpg. Страница Морозовой видна только вошедшим
update users u set avatar_file_id = pg_temp.file('avatars/' || split_part(u.email, '@', 1) || '.jpg', true, u.email),
                   page_visibility = case when u.email = 'athlete.second@example.test' then 'registered' else 'public' end::page_visibility;


-- ============================================================================
-- 3. Календарь событий федерации
-- ============================================================================

insert into calendar_events (id, title, description, starts_at, ends_at, location, is_online, registration_url, status, created_by)
select gen_random_uuid(), e.title, e.description,
       pg_temp.at(e.start, e.from_hour), pg_temp.at(e.start + e.days - 1, e.to_hour),
       e.location, e.online, e.url, e.status, pg_temp.user_id('federation@example.test')
from (values
  ('Открытая лекция «Как начать в спортивном программировании»',
   'Для школьников и родителей: дисциплины, соревнования, разряды и с чего начать.',
   10, 1, 18, 20, 'г. Оренбург, ОГУ, конференц-зал', false, null, 'published'),
  ('Учебно-тренировочные сборы сборной области',
   'Подготовка кандидатов в сборную к всероссийским соревнованиям.',
   40, 5, 9, 18, 'г. Оренбург, Технопарк', false, null, 'published'),
  ('Вебинар для тренеров: работа с платформой ФСП',
   'Как привязать спортсменов, подавать заявки и следить за сроками разрядов.',
   17, 1, 16, 17, null, true, 'https://example.test/webinar', 'published'),
  ('Отчётное собрание регионального отделения',
   'Итоги сезона и планы на следующий год.',
   75, 1, 11, 13, 'г. Оренбург', false, null, 'draft')
) e(title, description, start, days, from_hour, to_hour, location, online, url, status);


-- ============================================================================
-- 4. Новости
-- ============================================================================

-- Хэштеги хранятся массивом в самой статье, по алфавиту, как их сохраняет приложение. У черновика published_at пустой
insert into news_articles (id, slug, title, section, summary, hashtags, blocks, status, published_at, author_id)
select gen_random_uuid(), n.slug, n.title, n.section, n.summary,
       array(select tag from unnest(n.hashtags::varchar[]) tag order by tag), n.blocks::jsonb,
       case when n.days_ago is null then 'draft' else 'published' end,
       now() - make_interval(days => n.days_ago), pg_temp.user_id('federation@example.test')
from (values
  ('itogi-regionalnogo-etapa-po-produktovomu-programmirovaniyu',
   'Итоги регионального этапа по продуктовому программированию', 'Соревнования',
   '24 команды за 48 часов собрали сервисы для городских задач. Три лучшие едут на финал в Москву.',
   2, '{соревнования,продуктовое}',
   '[{"type": "text", "text": "Региональный этап прошёл в Технопарке ОГУ. Команды решали кейсы мэрии Оренбурга и двух ИТ-компаний области."},
     {"type": "heading", "text": "Победители", "level": 2},
     {"type": "text", "text": "1 место: «Ночные совы», сервис записи в секции.\n2 место: «Степь», учёт заявок ЖКХ.\n3 место: «Урал-Код», маршруты общественного транспорта."},
     {"type": "link", "url": "https://fsp-russia.ru/", "title": "Федерация спортивного программирования России"}]'),
  ('otkryt-nabor-v-sbornuyu-oblasti-po-algoritmicheskomu-programmirovaniyu',
   'Открыт набор в сборную области по алгоритмическому программированию', 'Сборная',
   'Отбор пройдёт в два тура: онлайн-контест и очное собеседование с тренерами.',
   6, '{сборная,алгоритмы}',
   '[{"type": "text", "text": "Приглашаем школьников 8–11 классов и студентов. Онлайн-тур откроется 15 ноября и продлится 5 часов."},
     {"type": "heading", "text": "Как подать заявку", "level": 2},
     {"type": "text", "text": "Зарегистрируйтесь на сайте как спортсмен и запишитесь на соревнование «Отбор в сборную» в каталоге."}]'),
  ('seminar-dlya-trenerov-po-informatsionnoy-bezopasnosti',
   'Семинар для тренеров по информационной безопасности', 'Обучение',
   'Разберём, как готовить команды к CTF: задачи, тренировочные площадки, распределение ролей.',
   11, '{тренерам,ctf}',
   '[{"type": "text", "text": "Семинар ведут судьи всероссийских соревнований по ИБ. Участие бесплатное, нужна регистрация в календаре событий."}]'),
  ('polozhenie-o-kubke-orenburgskoy-oblasti-2027',
   'Положение о Кубке Оренбургской области 2027', 'Документы',
   'Проект положения на согласовании.', null, '{документы}', '[]')
) n(slug, title, section, summary, days_ago, hashtags, blocks);


-- ============================================================================
-- 5. Соревнования
-- ============================================================================

-- Одна строка — одно соревнование. start — день старта от сегодня, points — баллы за места
-- (пишутся, только если соревнование верифицировано), regulations — есть ли положение в regulations/<code>.pdf
create temp table seed_contests (
  code text primary key, title text, description text, discipline text, kind text, level text, format text,
  municipality text, venue text, participation participation_type, team_min integer, team_max integer,
  age_groups text[], academic_groups text[], start integer, days integer,
  prize_text text, prize_amount integer, organizer text, status contest_status,
  verification verification_status, verification_reason text, cancel_reason text,
  points integer[], regulations boolean, id integer
);

insert into seed_contests (code, title, description, discipline, kind, level, format, municipality, venue,
  participation, team_min, team_max, age_groups, academic_groups, start, days, prize_text, prize_amount,
  organizer, status, verification, verification_reason, cancel_reason, points, regulations) values
  -- Предстоящие и витринные
  ('alg-pervenstvo', 'Первенство Оренбургской области по алгоритмическому программированию',
   'Личное первенство для школьников и студентов. Два тура по 5 часов, задачи в формате ICPC.',
   'Алгоритмическое программирование', 'Первенство', 'Региональное', 'Очно', 'г. Оренбург', 'ОГУ, пр. Победы, 13, корпус 2',
   'individual', null, null, '{14–17 лет}', '{}', 21, 2, null, null,
   'federation@example.test', 'registration_open', 'verified', null, null, '{40,30,20}', true),
  ('product-cup', 'Кубок Оренбуржья по продуктовому программированию',
   'Командная разработка продукта по кейсу от индустриального партнёра: два дня онлайн, защита очно.',
   'Продуктовое программирование', 'Кубок', 'Региональное', 'Смешанный', 'г. Оренбург', 'Технопарк «Оренбург»',
   'team', 3, 5, '{}', '{}', 35, 3, '150 000 ₽ призовых и стажировки у партнёров', 150000,
   'organizer@example.test', 'published', 'pending', null, null, '{40,30,20}', true),
  -- Верификации отказано: нет положения, поэтому и файла нет
  ('ctf-open', 'Открытый турнир по информационной безопасности (CTF)', 'Командный CTF в формате Jeopardy.',
   'Программирование систем информационной безопасности', 'Турнир', 'Межрегиональное', 'Онлайн', null, null,
   'team', 2, 4, '{}', '{}', 14, 1, null, null,
   'organizer@example.test', 'registration_open', 'rejected', 'Нет положения о соревновании', null, '{60,45,30}', false),
  ('ai-hackathon', 'Внутренний хакатон ОГУ по искусственному интеллекту', 'Хакатон для студентов университета.',
   'Программирование систем искусственного интеллекта', 'Турнир', 'Региональное', 'Очно', 'г. Оренбург', 'ОГУ, IT-холл',
   'team', 2, 3, '{}', '{}', 28, 2, 'Мерч и сертификаты на обучение', null,
   'organizer@example.test', 'published', 'not_requested', null, null, '{40,30,20}', true),
  ('robotics', 'Турнир по робототехнике', null,
   'Программирование робототехники', 'Турнир', 'Региональное', 'Очно', 'г. Новотроицк', null,
   'team', 2, 2, '{}', '{}', 60, 1, null, null,
   'organizer@example.test', 'draft', 'not_requested', null, null, '{40,30,20}', true),
  ('drones', 'Соревнования по программированию беспилотных авиационных систем', null,
   'Программирование беспилотных авиационных систем', 'Турнир', 'Региональное', 'Очно', 'Бузулукский район', null,
   'individual', null, null, '{}', '{}', 45, 1, null, null,
   'federation@example.test', 'cancelled', 'not_requested', null, 'Площадка недоступна из-за ремонта', '{40,30,20}', true),
  -- Прошедшие и идущие: заявки и места в разделе 6
  ('alg-championship', 'Чемпионат Оренбургской области по алгоритмическому программированию', 'Личный чемпионат области.',
   'Алгоритмическое программирование', 'Чемпионат', 'Региональное', 'Очно', 'г. Оренбург', 'ОГУ, корпус 2',
   'individual', null, null, '{}', '{}', -120, 1, null, null,
   'federation@example.test', 'completed', 'verified', null, null, '{40,30,20}', true),
  ('alg-pfo-cup', 'Кубок ПФО по алгоритмическому программированию', 'Межрегиональный кубок Приволжского федерального округа.',
   'Алгоритмическое программирование', 'Кубок', 'Межрегиональное', 'Очно', 'г. Оренбург', null,
   'individual', null, null, '{}', '{}', -210, 2, null, null,
   'federation@example.test', 'completed', 'verified', null, null, '{60,45,30,15,5}', true),
  ('orsk-open', 'Открытое первенство Орска по алгоритмическому программированию', null,
   'Алгоритмическое программирование', 'Первенство', 'Региональное', 'Очно', 'г. Орск', null,
   'individual', null, null, '{14–17 лет}', '{}', -60, 1, null, null,
   'organizer@example.test', 'completed', 'verified', null, null, '{40,30,20}', true),
  ('first-code', 'Турнир юных программистов «Первый код»', null,
   'Алгоритмическое программирование', 'Турнир', 'Региональное', 'Очно', 'г. Оренбург', null,
   'individual', null, null, '{До 14 лет}', '{}', -30, 1, null, null,
   'federation@example.test', 'completed', 'verified', null, null, '{40,30,20}', true),
  -- Без верификации: места есть, баллов нет
  ('lyceum', 'Внутренний турнир лицея № 1 по алгоритмике', null,
   'Алгоритмическое программирование', 'Турнир', 'Региональное', 'Очно', 'г. Оренбург', null,
   'individual', null, null, '{}', '{}', -20, 1, null, null,
   'organizer@example.test', 'completed', 'not_requested', null, null, '{40,30,20}', true),
  ('spring-product-cup', 'Весенний кубок Оренбуржья по продуктовому программированию', null,
   'Продуктовое программирование', 'Кубок', 'Региональное', 'Очно', 'г. Оренбург', null,
   'team', 2, 4, '{}', '{Студенты}', -150, 2, null, null,
   'federation@example.test', 'completed', 'verified', null, null, '{40,30,20}', true),
  ('ai-olympiad', 'Олимпиада школьников по искусственному интеллекту', null,
   'Программирование систем искусственного интеллекта', 'Первенство', 'Региональное', 'Очно', 'г. Оренбург', null,
   'individual', null, null, '{}', '{5–9 классы,10–11 классы}', -90, 1, null, null,
   'federation@example.test', 'completed', 'verified', null, null, '{40,30,20}', true),
  -- Идёт прямо сейчас: места вносит organizer@ на демо
  ('ctf-rubezh', 'Командный CTF «Оренбургский рубеж»', null,
   'Программирование систем информационной безопасности', 'Турнир', 'Региональное', 'Очно', 'г. Оренбург', null,
   'team', 2, 3, '{14–17 лет}', '{}', -1, 3, null, null,
   'organizer@example.test', 'in_progress', 'verified', null, null, '{40,30,20}', true);

-- История для аналитики: 18 личных соревнований раз в 38 дней за два года, чтобы у любого периода был прошлый.
-- Пятое и четырнадцатое отменены
insert into seed_contests (code, title, discipline, kind, level, format, municipality, participation,
  age_groups, academic_groups, start, days, organizer, status, verification, points, regulations)
select format('history-%s', lpad((i + 1)::text, 2, '0')),
       format('%s Оренбуржья по %s, этап %s', (array['Кубок', 'Первенство', 'Турнир', 'Чемпионат'])[i % 4 + 1],
              (array['алгоритмическому программированию', 'продуктовому программированию',
                     'программированию систем информационной безопасности',
                     'программированию систем искусственного интеллекта'])[i % 4 + 1], i + 1),
       (array['Алгоритмическое программирование', 'Продуктовое программирование',
              'Программирование систем информационной безопасности',
              'Программирование систем искусственного интеллекта'])[i % 4 + 1],
       (array['Кубок', 'Первенство', 'Турнир', 'Чемпионат'])[i % 4 + 1],
       (array['Региональное', 'Региональное', 'Региональное', 'Межрегиональное', 'Всероссийское'])[i % 5 + 1],
       (array['Очно', 'Очно', 'Онлайн', 'Смешанный'])[i % 4 + 1],
       (array['г. Оренбург', 'г. Орск', 'г. Новотроицк', 'г. Бузулук'])[i % 4 + 1],
       'individual', '{}', '{}', -700 + 38 * i, 1 + i % 3, 'organizer@example.test',
       case when i % 9 = 4 then 'cancelled' else 'completed' end::contest_status,
       case when i % 9 = 4 then 'not_requested' else 'verified' end::verification_status,
       '{40,30,20,10}', true
from generate_series(0, 17) i;

-- Регистрация открывается за 40 дней до старта и закрывается за 2 дня
insert into contests (title, description, discipline_id, contest_type_id, contest_level_id, contest_format_id,
  participation_type, team_size_min, team_size_max, municipality_id, venue, starts_on, ends_on,
  registration_opens_at, registration_closes_at, prize_fund_text, prize_fund_amount, regulations_file_id,
  organizer_id, created_by, status, cancel_reason, published_at, verification_status, verification_reason,
  verification_requested_at, verified_at, rating_points)
select c.title, c.description,
       pg_temp.dict('dictionary_disciplines', c.discipline), pg_temp.dict('dictionary_contest_types', c.kind),
       pg_temp.dict('dictionary_contest_levels', c.level), pg_temp.dict('dictionary_contest_formats', c.format),
       c.participation, c.team_min, c.team_max,
       case when c.municipality is not null then pg_temp.dict('dictionary_municipalities', c.municipality) end,
       c.venue, current_date + c.start, current_date + c.start + c.days - 1,
       ((current_date + c.start - 40)::timestamp) at time zone 'UTC',
       ((current_date + c.start - 2) + time '23:59') at time zone 'UTC',
       c.prize_text, c.prize_amount,
       case when c.regulations then pg_temp.file('regulations/' || c.code || '.pdf', c.status <> 'draft', c.organizer) end,
       pg_temp.user_id(c.organizer), pg_temp.user_id(c.organizer), c.status, c.cancel_reason,
       case when c.status <> 'draft' then now() end,
       c.verification, c.verification_reason,
       case when c.verification in ('pending', 'rejected') then now() end,
       case when c.verification = 'verified' then now() end,
       case when c.verification = 'verified' then
         (select jsonb_agg(jsonb_build_object('place', p.place, 'points', p.points) order by p.place)
          from unnest(c.points) with ordinality p(points, place)) end
from seed_contests c;

update seed_contests s set id = c.id from contests c where c.title = s.title;

insert into contest_age_groups (contest_id, age_group_id)
select c.id, pg_temp.dict('dictionary_age_groups', g) from seed_contests c, unnest(c.age_groups) g;

insert into contest_academic_groups (contest_id, academic_group_id)
select c.id, pg_temp.dict('dictionary_academic_groups', g) from seed_contests c, unnest(c.academic_groups) g;



-- ============================================================================
-- 6. Заявки и места прошедших соревнований
-- ============================================================================

-- Одна строка — одна одобренная заявка. place null у идущего — места ещё не внесены;
-- dsq — дисквалификация. coach — заявку подал тренер: ему пойдут благодарности и справки
create temp table seed_entries (
  contest text, team text, members text[], place integer, dsq boolean default false, coach text,
  application integer default nextval('contest_applications_id_seq')
);

insert into seed_entries (contest, team, members, place, dsq, coach) values
  ('alg-championship', null, '{athlete}', 1, false, null),
  ('alg-championship', null, '{18-stud.1}', 2, false, null),
  ('alg-championship', null, '{athlete.second}', 3, false, null),
  ('alg-championship', null, '{athlete.third}', 4, false, null),
  ('alg-championship', null, '{pupil1}', 5, false, 'coach'),
  ('alg-championship', null, '{18-stud.2}', 6, false, null),
  ('alg-championship', null, '{14-17-10-11.1}', 7, false, null),
  ('alg-championship', null, '{athlete.coach}', 8, false, null),
  ('alg-championship', null, '{18-stud.3}', 9, false, null),
  ('alg-championship', null, '{athlete.minor}', 10, false, null),
  ('alg-championship', null, '{pupil2}', 11, false, 'coach'),
  ('alg-championship', null, '{14-17-10-11.2}', null, true, null),

  ('alg-pfo-cup', null, '{18-stud.1}', 1, false, null),
  ('alg-pfo-cup', null, '{athlete}', 2, false, null),
  ('alg-pfo-cup', null, '{pupil1}', 3, false, 'coach'),
  ('alg-pfo-cup', null, '{athlete.second}', 4, false, null),
  ('alg-pfo-cup', null, '{18-stud.4}', 5, false, null),
  ('alg-pfo-cup', null, '{athlete.third}', 6, false, null),
  ('alg-pfo-cup', null, '{14-17-10-11.3}', 7, false, null),
  ('alg-pfo-cup', null, '{18-stud.5}', 8, false, null),
  ('alg-pfo-cup', null, '{pupil3}', 9, false, 'coach'),

  ('orsk-open', null, '{athlete.second}', 1, false, null),
  ('orsk-open', null, '{pupil1}', 2, false, null),
  ('orsk-open', null, '{pupil3}', 3, false, 'coach'),
  ('orsk-open', null, '{14-17-10-11.1}', 4, false, null),
  ('orsk-open', null, '{14-17-10-11.4}', 5, false, null),
  ('orsk-open', null, '{14-17-5-9.1}', 6, false, null),
  ('orsk-open', null, '{14-17-5-9.2}', 7, false, null),
  ('orsk-open', null, '{pupil2}', 8, false, null),
  ('orsk-open', null, '{14-17-stud.1}', 9, false, null),
  ('orsk-open', null, '{athlete.minor}', 10, false, null),

  ('first-code', null, '{u14-5-9.1}', 1, false, null),
  ('first-code', null, '{u14-5-9.2}', 2, false, null),
  ('first-code', null, '{u14-5-9.3}', 3, false, null),
  ('first-code', null, '{u14-1-4.1}', 4, false, null),
  ('first-code', null, '{u14-5-9.4}', 5, false, null),
  ('first-code', null, '{u14-1-4.2}', 6, false, null),
  ('first-code', null, '{u14-1-4.3}', 7, false, null),

  ('lyceum', null, '{pupil3}', 1, false, null),
  ('lyceum', null, '{14-17-10-11.5}', 2, false, null),
  ('lyceum', null, '{14-17-10-11.6}', 3, false, null),

  ('spring-product-cup', 'Байт-бригада', '{athlete,18-stud.2,18-stud.3}', 1, false, null),
  ('spring-product-cup', 'Null Pointer', '{athlete.third,18-stud.4,18-stud.5}', 2, false, null),
  ('spring-product-cup', 'Оренбургский стек', '{athlete.coach,18-stud.6,14-17-stud.1}', 3, false, 'coach.judge'),
  ('spring-product-cup', 'Код без сна', '{18-stud.1,14-17-stud.2}', 4, false, null),

  ('ai-olympiad', null, '{pupil3}', 1, false, 'coach'),
  ('ai-olympiad', null, '{14-17-10-11.5}', 2, false, null),
  ('ai-olympiad', null, '{athlete.second}', 3, false, null),
  ('ai-olympiad', null, '{14-17-5-9.3}', 4, false, null),
  ('ai-olympiad', null, '{pupil2}', 5, false, 'coach.judge'),
  ('ai-olympiad', null, '{u14-5-9.1}', 6, false, null),
  ('ai-olympiad', null, '{14-17-10-11.6}', 7, false, null),
  ('ai-olympiad', null, '{athlete.minor}', 8, false, null),
  ('ai-olympiad', null, '{u14-5-9.4}', 9, false, null),

  ('ctf-rubezh', 'Root Access', '{pupil1,pupil3,14-17-10-11.1}', null, false, 'coach'),
  ('ctf-rubezh', 'Флаг в руки', '{athlete.second,14-17-10-11.2,14-17-10-11.3}', null, false, null),
  ('ctf-rubezh', 'Синий экран', '{14-17-5-9.1,14-17-5-9.4}', null, false, null),
  ('ctf-rubezh', 'Оренбит', '{14-17-10-11.4,14-17-10-11.5,14-17-stud.1}', null, false, null);


-- Все заявки одобрены федерацией за 5 дней до старта. id заявки выдан заранее (seed_entries.application),
-- чтобы участники и места ссылались на неё без поиска
insert into contest_applications (id, contest_id, team_name, created_by, created_as, status, decided_by, decided_at, submitted_at)
select e.application, c.id, e.team,
       pg_temp.user_id(coalesce(e.coach, e.members[1]) || '@example.test'),
       case when e.coach is null then 'athlete' else 'coach' end::application_creator,
       'approved', pg_temp.user_id('federation@example.test'),
       ((current_date + c.start - 5) + time '12:00') at time zone 'UTC',
       ((current_date + c.start - 5) + time '12:00') at time zone 'UTC'
from seed_entries e join seed_contests c on c.code = e.contest;

-- Первый в списке — капитан
insert into contest_application_members (application_id, contest_id, user_id, is_captain, confirmation, is_active,
                                         age_group_id, academic_group_id, responded_at)
select e.application, c.id, u.id, m.n = 1, 'confirmed', true,
       pg_temp.age_group(u.birth_date, c.id), u.academic_group_id,
       ((current_date + c.start - 5) + time '12:00') at time zone 'UTC'
from seed_entries e join seed_contests c on c.code = e.contest,
     unnest(e.members) with ordinality m(login, n) join users u on u.email = m.login || '@example.test';

-- Места только у завершённых; баллы — из rating_points верифицированного соревнования
insert into contest_results (contest_id, application_id, user_id, place, points)
select c.id, e.application, u.id, e.place,
       case when c.verification = 'verified' and e.place is not null then coalesce(c.points[e.place], 0) else 0 end
from seed_entries e join seed_contests c on c.code = e.contest,
     unnest(e.members) m(login) join users u on u.email = m.login || '@example.test'
where c.status = 'completed';


-- ============================================================================
-- 7. История для аналитики: заявки и места
-- ============================================================================

-- На каждый этап: пятеро «постоянных» из первых десяти спортсменов по категориям и от трёх до семи
-- «новичков»: чем ближе к сегодня, тем шире круг новых лиц. Отбор и исходы заданы формулами,
-- поэтому при каждой заливке цифры одинаковые: около 15 % отказов, 5 % отзывов, половину заявок подают тренеры
create temp table seed_history_entries as
with stage as (
  select c.*, (substr(c.code, 9))::integer - 1 as i from seed_contests c
  where c.code like 'history-%' and c.status = 'completed'
), regular as (
  select s.id as contest_id, s.i, p.email, p.ord from stage s join seed_people p on p.ord between 1 and 10
  where (p.ord + s.i) % 2 = 0
), fresh as (
  select * from (
    select s.id as contest_id, s.i, p.email, p.ord,
           row_number() over (partition by s.id order by (p.ord * 7 + s.i * 3) % 31, p.ord) as pick
    from stage s join seed_people p on p.ord between 11 and 10 + least(19, 4 + s.i * 21 / 18)
  ) f where f.pick <= 3 + f.i % 5
)
select x.contest_id, x.i, x.email, x.ord,
       case when (x.i * 7 + x.ord * 13) % 20 < 3 then 'rejected'
            when (x.i * 7 + x.ord * 13) % 20 = 3 then 'withdrawn'
            else 'approved' end::application_status as status,
       case (x.i + x.ord) % 4 when 0 then 'coach@example.test' when 1 then 'coach.judge@example.test' end as coach,
       (array['Не приложено согласие законного представителя', 'Возраст не подходит под группы соревнования',
              'Не приложено согласие законного представителя', 'Заявка подана после закрытия регистрации',
              'Нет академической группы в профиле'])[(x.i + x.ord) % 5 + 1] as reason,
       nextval('contest_applications_id_seq')::integer as application
from (select contest_id, i, email, ord from regular union all select contest_id, i, email, ord from fresh) x;

insert into contest_applications (id, contest_id, created_by, created_as, status, reject_reason, decided_by, decided_at, submitted_at)
select h.application, h.contest_id, pg_temp.user_id(coalesce(h.coach, h.email)),
       case when h.coach is null then 'athlete' else 'coach' end::application_creator,
       h.status, case when h.status = 'rejected' then h.reason end,
       case when h.status <> 'withdrawn' then pg_temp.user_id('federation@example.test') end,
       case when h.status <> 'withdrawn' then ((c.starts_on - 5) + time '12:00') at time zone 'UTC' end,
       ((c.starts_on - 5) + time '12:00') at time zone 'UTC'
from seed_history_entries h join contests c on c.id = h.contest_id;

insert into contest_application_members (application_id, contest_id, user_id, is_captain, confirmation, is_active,
                                         age_group_id, academic_group_id, responded_at)
select h.application, h.contest_id, u.id, true, 'confirmed', true,
       pg_temp.age_group(u.birth_date, h.contest_id), u.academic_group_id,
       ((c.starts_on - 5) + time '12:00') at time zone 'UTC'
from seed_history_entries h join users u on u.email = h.email join contests c on c.id = h.contest_id;

-- Места одобренным по порядку, баллы 40/30/20/10 за первые четыре
insert into contest_results (contest_id, application_id, user_id, place, points)
select r.contest_id, r.application, u.id, r.place, coalesce((array[40, 30, 20, 10])[r.place], 0)
from (select h.*, row_number() over (partition by h.contest_id order by (h.ord * 5 + h.i) % 17, h.ord)::integer as place
      from seed_history_entries h where h.status = 'approved') r
join users u on u.email = r.email;


-- ============================================================================
-- 8. Судейские коллегии
-- ============================================================================

insert into judge_assignments (id, contest_id, judge_id, position_id, assigned_by)
select gen_random_uuid(), c.id, pg_temp.user_id(j.judge), pg_temp.dict('dictionary_judge_positions', j.position),
       pg_temp.user_id(c.organizer)
from (values
  ('alg-championship', 'judge@example.test', 'Главный судья'),
  ('alg-championship', 'coach.judge@example.test', 'Главный секретарь'),
  ('ai-olympiad', 'judge@example.test', 'Главный судья'),
  ('spring-product-cup', 'coach.judge@example.test', 'Главный судья')
) j(contest, judge, position) join seed_contests c on c.code = j.contest;

-- Ближайшее соревнование через 10+ дней: главный судья уже назначен
insert into judge_assignments (id, contest_id, judge_id, position_id, assigned_by)
select gen_random_uuid(), c.id, pg_temp.user_id('coach.judge@example.test'),
       pg_temp.dict('dictionary_judge_positions', 'Главный судья'), c.organizer_id
from contests c where c.starts_on > current_date + 10 and c.status <> 'cancelled'
order by c.starts_on limit 1;

-- История: главный судья и секретарь меняются местами от этапа к этапу, каждый пятый этап без коллегии
insert into judge_assignments (id, contest_id, judge_id, position_id, assigned_by)
select gen_random_uuid(), c.id,
       pg_temp.user_id(case when (s.i + k) % 2 = 0 then 'judge@example.test' else 'coach.judge@example.test' end),
       pg_temp.dict('dictionary_judge_positions', case k when 0 then 'Главный судья' else 'Главный секретарь' end),
       pg_temp.user_id(c.organizer)
from seed_contests c, lateral (select (substr(c.code, 9))::integer - 1 as i) s, generate_series(0, 1) k
where c.code like 'history-%' and c.status = 'completed' and s.i % 5 <> 3;


-- Документы судей к протоколу чемпионата: главный судья приложил записку и акт, секретарь — протокол.
-- Секретаря после загрузки сняли с коллегии: его документ остаётся с пометкой «снят». Файлы — judge_documents/
insert into judge_documents (id, contest_id, assignment_id, judge_id, kind, file_id, comment)
select gen_random_uuid(), c.id, a.id, a.judge_id, d.kind::judge_document_kind,
       pg_temp.file('judge_documents/' || d.file, true, d.judge), d.comment
from (values
  ('judge@example.test', 'note', 'zapiska.pdf', 'Апелляций не поступало'),
  ('judge@example.test', 'act', 'akt-proverki.pdf', 'Проверка рабочих мест перед туром'),
  ('coach.judge@example.test', 'protocol', 'protokol-sekretarya.pdf', null)
) d(judge, kind, file, comment)
join seed_contests c on c.code = 'alg-championship'
join judge_assignments a on a.contest_id = c.id and a.judge_id = pg_temp.user_id(d.judge);

update judge_assignments a set removed_at = now(), removed_by = pg_temp.user_id(c.organizer)
from seed_contests c
where c.code = 'alg-championship' and a.contest_id = c.id and a.judge_id = pg_temp.user_id('coach.judge@example.test');


-- ============================================================================
-- 9. Разряды и судейские категории
-- ============================================================================

-- start — день присвоения от сегодня, length — срок в днях. Документ-основание лежит в orders/qualifications/.
-- Срок категории Орлова кончается через 5 дней: напоминание придёт сразу после запуска
insert into qualifications (id, kind, user_id, submitted_by, judge_category_id, rank_type_id, document_file_id,
                            basis, status, decided_by, decided_at, valid_from, valid_until)
select gen_random_uuid(), q.kind::qualification_kind, pg_temp.user_id(q.owner), pg_temp.user_id(q.submitter),
       case when q.kind = 'judge_category' then pg_temp.dict('dictionary_judge_categories', q.item) end,
       case when q.kind = 'rank' then pg_temp.dict('dictionary_rank_types', q.item) end,
       pg_temp.file(q.document, false, q.submitter),
       case when q.approved then 'Приказ Минспорта Оренбургской области' else 'Протокол соревнования' end,
       case when q.approved then 'approved' else 'pending' end::qualification_status,
       case when q.approved then pg_temp.user_id('federation@example.test') end,
       case when q.approved then now() + make_interval(days => q.start) end,
       case when q.approved then current_date + q.start end,
       case when q.approved then current_date + q.start + q.length end
from (values
  ('judge@example.test', 'judge@example.test', 'judge_category', 'Спортивный судья второй категории', true, -725, 730,
   'orders/qualifications/judge.pdf'),
  ('coach.judge@example.test', 'coach.judge@example.test', 'judge_category', 'Спортивный судья первой категории', true, -300, 1160,
   'orders/qualifications/coach.judge-1.pdf'),
  ('coach.judge@example.test', 'coach.judge@example.test', 'judge_category', 'Спортивный судья всероссийской категории', false, 0, 0,
   'orders/qualifications/coach.judge-2.pdf'),
  ('athlete@example.test', 'athlete@example.test', 'rank', 'Второй спортивный разряд', true, -200, 530,
   'orders/qualifications/athlete-1.pdf'),
  ('athlete@example.test', 'athlete@example.test', 'rank', 'Первый спортивный разряд', false, 0, 0,
   'orders/qualifications/athlete-2.pdf'),
  -- Подал тренер за подопечного
  ('pupil1@example.test', 'coach@example.test', 'rank', 'Второй юношеский спортивный разряд', true, -400, 800,
   'orders/qualifications/pupil1.pdf')
) q(owner, submitter, kind, item, approved, start, length, document);

-- Разряды первых четырнадцати спортсменов по категориям: для блока разрядов в аналитике
insert into qualifications (id, kind, user_id, submitted_by, rank_type_id, document_file_id, basis, status,
                            decided_by, decided_at, valid_from, valid_until)
select gen_random_uuid(), 'rank', u.id, u.id,
       pg_temp.dict('dictionary_rank_types', (array['Третий спортивный разряд', 'Третий юношеский спортивный разряд',
                                                    'Второй юношеский спортивный разряд'])[(p.ord - 1) % 3 + 1]),
       pg_temp.file('orders/qualifications/' || split_part(p.email, '@', 1) || '.pdf', false, p.email),
       'Приказ Минспорта Оренбургской области', 'approved', pg_temp.user_id('federation@example.test'),
       now() - make_interval(days => 20 + 45 * (p.ord - 1)),
       current_date - 20 - 45 * (p.ord - 1), current_date - 20 - 45 * (p.ord - 1) + 730
from seed_people p join users u on u.email = p.email
where p.ord between 1 and 14;


-- ============================================================================
-- 10. Согласия законных представителей
-- ============================================================================

-- У каждого несовершеннолетнего спортсмена, кроме Ахмедова (pupil3): без согласия заявку не подать.
-- У Морозовой согласие ждёт проверки федерации. Скан — consents/<почта до @>.pdf
insert into guardian_consents (id, user_id, guardian_name, guardian_phone, file_id, status, decided_by, decided_at)
select gen_random_uuid(), u.id, g.guardian, g.phone,
       pg_temp.file('consents/' || g.login || '.pdf', false, u.email),
       case when g.login = 'athlete.second' then 'pending' else 'approved' end::consent_status,
       case when g.login <> 'athlete.second' then pg_temp.user_id('federation@example.test') end,
       case when g.login <> 'athlete.second' then now() end
from (values
  ('athlete.second', 'Морозова Ирина Сергеевна', '+7 912 345-10-01'),
  ('pupil1', 'Ковалёва Татьяна Петровна', '+7 912 345-10-02'),
  ('pupil2', 'Фёдоров Роман Андреевич', '+7 912 345-10-03'),
  ('athlete.minor', 'Белова Наталья Викторовна', '+7 912 345-10-04'),
  ('u14-1-4.1', 'Смирнова Ирина Сергеевна', '+7 912 345-10-05'),
  ('u14-1-4.2', 'Попова Ольга Николаевна', '+7 912 345-10-06'),
  ('u14-1-4.3', 'Васильев Андрей Игоревич', '+7 912 345-10-07'),
  ('u14-1-4.4', 'Новикова Анна Владимировна', '+7 912 345-10-08'),
  ('u14-5-9.1', 'Петрова Елена Александровна', '+7 912 345-10-09'),
  ('u14-5-9.2', 'Козлов Илья Сергеевич', '+7 912 345-10-10'),
  ('u14-5-9.3', 'Лебедева Мария Олеговна', '+7 912 345-10-11'),
  ('u14-5-9.4', 'Орлова Светлана Юрьевна', '+7 912 345-10-12'),
  ('14-17-5-9.1', 'Соловьёва Екатерина Ивановна', '+7 912 345-10-13'),
  ('14-17-5-9.2', 'Медведев Артём Валерьевич', '+7 912 345-10-14'),
  ('14-17-5-9.3', 'Волкова Юлия Андреевна', '+7 912 345-10-15'),
  ('14-17-5-9.4', 'Зайцева Ольга Михайловна', '+7 912 345-10-16'),
  ('14-17-10-11.1', 'Павлова Наталья Сергеевна', '+7 912 345-10-17'),
  ('14-17-10-11.2', 'Семёнов Максим Олегович', '+7 912 345-10-18'),
  ('14-17-10-11.3', 'Голубева Марина Викторовна', '+7 912 345-10-19'),
  ('14-17-10-11.4', 'Виноградова Алла Петровна', '+7 912 345-10-20'),
  ('14-17-10-11.5', 'Богданов Илья Сергеевич', '+7 912 345-10-21'),
  ('14-17-10-11.6', 'Тарасова Людмила Ивановна', '+7 912 345-10-22'),
  ('14-17-stud.1', 'Фролова Оксана Викторовна', '+7 912 345-10-23'),
  ('14-17-stud.2', 'Киселёв Дмитрий Андреевич', '+7 912 345-10-24'),
  ('nogroup.1', 'Ершова Валентина Сергеевна', '+7 912 345-10-25')
) g(login, guardian, phone)
join users u on u.email = g.login || '@example.test'
where pg_temp.age_on(u.birth_date, current_date) < 18;


-- ============================================================================
-- 11. Сборные
-- ============================================================================

-- Приказ задаёт дисциплину, группу и размеры составов. Сам состав — верх рейтинга группы на сегодня
-- по правилам приложения: баллы за 365 дней, затем свежесть последней победы, среднее место, ФИО
create temp table seed_squads (discipline text, age_group text, main_size integer, reserve_size integer,
                               order_number text, order_days integer, order_file text, id integer);

insert into seed_squads values
  ('Алгоритмическое программирование', '14–17 лет', 3, 2, '17-сб', -20, 'orders/squads/alg-14-17.pdf', null),
  ('Продуктовое программирование', '18 лет и старше', 2, 1, '41-сб', -45, 'orders/squads/product-18.pdf', null);

with created as (
  insert into squads (discipline_id, age_group_id, main_size, reserve_size, order_number, order_date, order_file_id, approved_by)
  select pg_temp.dict('dictionary_disciplines', s.discipline), pg_temp.dict('dictionary_age_groups', s.age_group),
         s.main_size, s.reserve_size, s.order_number, current_date + s.order_days,
         pg_temp.file(s.order_file, true, 'federation@example.test'), pg_temp.user_id('federation@example.test')
  from seed_squads s
  returning id, order_number
)
update seed_squads s set id = created.id from created where created.order_number = s.order_number;

insert into squad_members (squad_id, user_id, position, is_reserve, points)
select ranked.squad_id, ranked.user_id, ranked.position, ranked.position > ranked.main_size, ranked.points
from (
  select q.id as squad_id, q.main_size, q.reserve_size, r.user_id, r.points,
         row_number() over (partition by q.id order by r.points desc, r.last_win desc nulls last,
                            r.average_place, u.last_name, u.first_name, u.middle_name)::integer as position
  from seed_squads q
  join dictionary_age_groups g on g.name = q.age_group
  cross join lateral (
    select res.user_id, sum(res.points)::integer as points,
           max(c.ends_on) filter (where res.place = 1) as last_win,
           avg(res.place) filter (where res.place is not null) as average_place
    from contest_results res
    join contest_applications a on a.id = res.application_id and a.status = 'approved'
    join contests c on c.id = res.contest_id
    where c.verification_status = 'verified' and c.ends_on >= current_date - 365
      and c.discipline_id = pg_temp.dict('dictionary_disciplines', q.discipline)
    group by res.user_id
  ) r
  join users u on u.id = r.user_id and u.is_active
  where pg_temp.age_on(u.birth_date, current_date) between coalesce(g.min_age, 0) and coalesce(g.max_age, 200)
) ranked
where ranked.position <= ranked.main_size + ranked.reserve_size;


-- ============================================================================
-- 12. Лента на странице человека
-- ============================================================================

insert into wall_posts (id, user_id, role, contest_id, text)
select gen_random_uuid(), pg_temp.user_id(w.author), w.role::wall_role, c.id, w.text
from (values
  ('athlete@example.test', 'athlete', 'alg-championship',
   'Решил пять задач из семи. Больше всего времени ушло на задачу про графы: ошибся в оценке сложности и переписывал решение на последнем часу.'),
  ('athlete@example.test', 'athlete', 'alg-pfo-cup',
   'Первый выезд на межрегиональный уровень. Два дня, сильные соперники из Самары и Казани.'),
  ('athlete.minor@example.test', 'athlete', 'alg-championship', 'Первые соревнования. Сдала три задачи.'),
  ('coach@example.test', 'coach', 'alg-championship',
   'Двое моих учеников впервые выступили на чемпионате области. Готовились с сентября.')
) w(author, role, contest, text) join seed_contests c on c.code = w.contest;


-- ============================================================================
-- 13. Уведомления и администраторы Telegram-бота
-- ============================================================================

insert into notifications (id, user_id, type, title, text, link, is_read, email_status, created_at)
select gen_random_uuid(), pg_temp.user_id(n.address), n.type, n.title, n.text, n.link, n.is_read, 'not_required',
       now() - make_interval(hours => n.hours_ago)
from (values
  ('federation@example.test', 'role.requested', 'Новая заявка на роль', 'Петрова Анна запрашивает роль «Организатор».',
   '/cabinet/federation/accounts', 2, false),
  ('federation@example.test', 'role.requested', 'Новая заявка на роль', 'Лебедев Максим запрашивает роль «Судья».',
   '/cabinet/federation/accounts', 5, false),
  ('federation@example.test', 'contest.verification_requested', 'Соревнование ждёт верификации',
   '«Кубок Оренбуржья по продуктовому программированию»: организатор запросил верификацию.',
   '/cabinet/federation/competitions?tab=queue', 26, false),
  ('federation@example.test', 'application.submitted', 'Новая заявка',
   'На «Первенство Оренбургской области по алгоритмическому программированию» подана заявка: Морозова Дарья.',
   '/cabinet/federation/participants', 50, true),
  ('federation@example.test', 'role.requested', 'Новая заявка на роль', 'Новиков Денис запрашивает роль «Тренер».',
   '/cabinet/federation/accounts', 75, true),
  ('organizer@example.test', 'application.submitted', 'Новая заявка',
   'На «Открытый турнир по информационной безопасности (CTF)» подана заявка: Степные хакеры.',
   '/cabinet/organizer/participants', 6, false),
  ('organizer@example.test', 'contest.verification_rejected', 'Отказ в верификации',
   '«Открытый турнир по информационной безопасности (CTF)»: федерация отказала в верификации. Причина: Нет положения о соревновании',
   '/cabinet/organizer/competitions', 30, false),
  ('athlete.minor@example.test', 'application.invited', 'Приглашение в команду',
   'Соколов Артём приглашает вас в команду «Байтики» на «Открытый турнир по информационной безопасности (CTF)». Подтвердите участие.',
   '/cabinet/athlete/my-contests', 3, false),
  ('athlete.minor@example.test', 'application.approved', 'Заявка одобрена',
   'Заявка на «Первенство Оренбургской области по алгоритмическому программированию» одобрена.',
   '/cabinet/athlete/my-contests', 28, false),
  ('athlete.second@example.test', 'application.invited', 'Вас записали на соревнование',
   'Вас записали в команду «Степные хакеры» на «Открытый турнир по информационной безопасности (CTF)». Тренер: Тренеров Игорь. Подтвердите участие.',
   '/cabinet/athlete/my-contests', 52, true),
  ('coach@example.test', 'role.approved', 'Роль подтверждена', 'Федерация подтвердила роль «Тренер». Кабинет открыт.',
   '/cabinet/coach', 170, true),
  ('judge@example.test', 'role.approved', 'Роль подтверждена', 'Федерация подтвердила роль «Судья». Кабинет открыт.',
   '/cabinet/judge', 200, true)
) n(address, type, title, text, link, hours_ago, is_read);

insert into bot_admins (user_id, level, granted_by) values
  (pg_temp.user_id('federation@example.test'), 'owner', null),
  (pg_temp.user_id('minister@example.test'), 'admin', pg_temp.user_id('federation@example.test'));


-- ============================================================================
-- 14. Документы к выпуску
-- ============================================================================

-- Сами документы выпускает bootstrap кодом приложения: номер, получатели, снимок данных и подпись.
-- Дата выдачи — через три дня после окончания соревнования
create temp table seed_documents (contest_id integer, kind document_kind, form jsonb);

insert into seed_documents
select c.id, d.kind::document_kind,
       d.form || jsonb_build_object('issued_on', (c.ends_on + 3)::text,
                                    'signer_position', 'Председатель регионального отделения ФСП',
                                    'signer_name', 'О. В. Федеральцев')
from (values
  ('alg-championship', 'diploma',
   '{"title": "Диплом", "recipients": "winners", "places_to": 3, "lead": "награждается", "text": "за высокие результаты"}'::jsonb),
  ('alg-championship', 'certificate',
   '{"title": "Сертификат", "recipients": "participants", "places_to": 3, "lead": "подтверждает, что", "text": "принял(а) участие в соревновании"}'),
  ('spring-product-cup', 'diploma',
   '{"title": "Диплом", "recipients": "winners", "places_to": 3, "lead": "награждается", "text": "за высокие результаты"}'),
  ('alg-championship', 'judge_thanks',
   '{"title": "Благодарность", "recipients": "participants", "places_to": 3, "lead": "выражается", "text": "за объективное судейство"}'),
  ('spring-product-cup', 'certificate',
   '{"title": "Сертификат", "recipients": "participants", "places_to": 3, "lead": "подтверждает, что", "text": "принял(а) участие в соревновании"}'),
  ('ai-olympiad', 'thanks',
   '{"title": "Благодарность", "recipients": "participants", "places_to": 3, "lead": "выражается", "text": "за подготовку спортсменов"}'),
  ('ai-olympiad', 'reference',
   '{"title": "об участии в соревновании", "recipients": "participants", "places_to": 3, "lead": null, "text": "Справка выдана для предъявления по месту требования."}')
) d(contest, kind, form) join seed_contests sc on sc.code = d.contest join contests c on c.id = sc.id;
