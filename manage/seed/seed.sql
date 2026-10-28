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
  -- Пример кейса для рейтинга: у Соколова 40 за чемпионат, 45 за кубок ПФО и 0 за пятое место здесь.
  -- Призёр двух соревнований — итог 85 × 1,2 = 102
  ('alg-ogu-open', 'Открытый турнир ОГУ по алгоритмическому программированию', 'Личный онлайн-турнир для студентов и школьников.',
   'Алгоритмическое программирование', 'Турнир', 'Региональное', 'Онлайн', null, null,
   'individual', null, null, '{}', '{}', -75, 1, null, null,
   'organizer@example.test', 'completed', 'verified', null, null, '{40,30,20}', false),
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

  ('alg-ogu-open', null, '{18-stud.1}', 1, false, null),
  ('alg-ogu-open', null, '{18-stud.2}', 2, false, null),
  ('alg-ogu-open', null, '{athlete.third}', 3, false, null),
  ('alg-ogu-open', null, '{18-stud.3}', 4, false, null),
  ('alg-ogu-open', null, '{athlete}', 5, false, null),

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


-- У присвоенных — приказ за два дня до начала срока и токен QR-проверки. Подпись ставит bootstrap кодом приложения
update qualifications q
set order_number = extract(year from q.valid_from)::integer || '-р/' || (100 + n.num),
    order_date = q.valid_from - 2,
    token = substr(md5(q.id::text || random()::text), 1, 16)
from (select id, row_number() over (order by valid_from, user_id) as num from qualifications where status = 'approved') n
where n.id = q.id;


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
-- по правилам приложения: баллы за 365 дней (призёру двух соревнований × 1,2), затем свежесть последней победы,
-- среднее место, ФИО
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
    select res.user_id,
           round(sum(res.points) * case when count(*) filter (where res.place <= 3) >= 2 then 1.2 else 1 end)::integer as points,
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


-- ============================================================================
-- 15. Организации, спортивные профили, тренеры и антидопинг
-- ============================================================================

-- Организации вымышленные, ИНН — только формат. Лицензия — у спортивных школ, вузов и колледжей
insert into organizations (name, short_name, organization_type_id, municipality_id, inn, license_number)
select o.name, o.short_name, pg_temp.dict('dictionary_organization_types', o.kind),
       pg_temp.dict('dictionary_municipalities', o.place), o.inn,
       case when o.kind in ('Спортивная школа', 'Вуз', 'Колледж / техникум') then 'Л035-' || right(o.inn, 4) end
from (values
  (1, 'МАОУ «Лицей № 1» г. Оренбурга', 'Лицей № 1', 'Лицей / гимназия', 'г. Оренбург', '5610000011'),
  (2, 'МОАУ «Гимназия № 3» г. Орска', 'Гимназия № 3', 'Лицей / гимназия', 'г. Орск', '5615000022'),
  (3, 'ФГБОУ ВО «Оренбургский государственный университет»', 'ОГУ', 'Вуз', 'г. Оренбург', '5612000033'),
  (4, 'Оренбургский колледж информационных технологий', 'ОКИТ', 'Колледж / техникум', 'г. Оренбург', '5609000044'),
  (5, 'СШ «Цифровой спорт» г. Новотроицка', 'СШ «Цифровой спорт»', 'Спортивная школа', 'г. Новотроицк', '5607000055'),
  (6, 'Клуб спортивного программирования «Байт»', 'Клуб «Байт»', 'Спортивный клуб', 'г. Бузулук', '5603000066')
) o(ord, name, short_name, kind, place, inn)
order by o.ord;

-- Спортсмены по почте: организация по кругу, каждый седьмой без организации. Год начала занятий — не раньше 7 лет,
-- этап подготовки — по возрасту. Основная дисциплина — алгоритмика или продуктовое; у каждого третьего вторая,
-- у некоторых в прошлом была робототехника: так у отчёта о численности есть динамика по годам
create temp table seed_athletes as
select u.id, u.first_name, u.birth_date,
       (row_number() over (order by u.email) - 1)::integer as n,
       greatest(extract(year from u.birth_date)::integer + 7,
                extract(year from current_date)::integer - 1 - ((row_number() over (order by u.email) - 1)::integer % 5)) as start_year
from users u join user_roles r on r.user_id = u.id and r.role = 'athlete' and r.status = 'verified';

insert into athlete_profiles (user_id, sex, organization_id, no_organization, start_year, training_stage)
select a.id, case when right(a.first_name, 1) in ('а', 'я') and a.first_name not in ('Никита', 'Илья') then 'female' else 'male' end::sex,
       o.id, o.id is null, a.start_year,
       case when pg_temp.age_on(a.birth_date, current_date) < 12 then 'initial'
            when pg_temp.age_on(a.birth_date, current_date) < 15 then 'training'
            when pg_temp.age_on(a.birth_date, current_date) < 18 then 'improvement'
            else 'highest' end::training_stage
from seed_athletes a
left join organizations o on a.n % 7 <> 6 and o.id = (select id from organizations order by id offset a.n % 6 limit 1);

insert into athlete_organizations (user_id, organization_id, valid_from)
select p.user_id, p.organization_id, make_date(p.start_year, 9, 1) from athlete_profiles p;

insert into athlete_disciplines (user_id, discipline_id, valid_from, valid_to)
select a.id, pg_temp.dict('dictionary_disciplines', d.discipline), d.valid_from, d.valid_to
from seed_athletes a,
lateral (values
  ((array['Алгоритмическое программирование', 'Продуктовое программирование'])[a.n % 2 + 1],
   make_date(a.start_year, 9, 1), null::date, true),
  ('Программирование робототехники', make_date(a.start_year - 2, 9, 1), make_date(a.start_year, 9, 1), a.n % 8 = 3),
  ((array['Программирование систем информационной безопасности', 'Программирование робототехники'])[a.n % 2 + 1],
   make_date(least(a.start_year + 1, extract(year from current_date)::integer), 1, 15), null::date, a.n % 3 = 0)
) d(discipline, valid_from, valid_to, wanted)
where d.wanted;

-- Тренеров ведёт четырёх подопечных и Морозову по алгоритмике (по одному — открыт срок апелляции), с Ахмедовым — перерыв.
-- Зайцева ждёт ответа Соколова по продуктовому программированию
insert into coach_links (id, coach_id, athlete_id, discipline_id, status, created_at)
select gen_random_uuid(), pg_temp.user_id(l.coach), pg_temp.user_id(l.athlete),
       pg_temp.dict('dictionary_disciplines', l.discipline), l.status::coach_link_status, now() - interval '30 days'
from (values
  ('coach@example.test', 'pupil1@example.test', 'Алгоритмическое программирование', 'active'),
  ('coach@example.test', 'pupil2@example.test', 'Алгоритмическое программирование', 'active'),
  ('coach@example.test', 'pupil3@example.test', 'Алгоритмическое программирование', 'suspended'),
  ('coach@example.test', 'athlete.second@example.test', 'Алгоритмическое программирование', 'active'),
  ('coach@example.test', '14-17-10-11.5@example.test', 'Алгоритмическое программирование', 'active'),
  ('coach.judge@example.test', 'athlete@example.test', 'Продуктовое программирование', 'requested')
) l(coach, athlete, discipline, status);

insert into coach_link_events (id, link_id, status, actor_id, comment, created_at)
select gen_random_uuid(), l.id, e.status::coach_link_status,
       case when e.by_coach then l.coach_id else l.athlete_id end, e.comment, now() - make_interval(days => e.days_ago)
from coach_links l,
lateral (values
  ('requested', true, case when l.status = 'requested' then 'Готовлю команду к кубку по продуктовому программированию' end, 30, true),
  ('active', false, null, 29, l.status <> 'requested'),
  ('suspended', true, 'Перерыв на сессию', 2, l.status = 'suspended')
) e(status, by_coach, comment, days_ago, wanted)
where e.wanted;

-- Курс РУСАДА Соколова истекает через 15 дней: напоминание придёт сразу после запуска
insert into antidoping_certificates (id, user_id, passed_on, valid_until, certificate_url)
values (gen_random_uuid(), pg_temp.user_id('athlete@example.test'), current_date - 350, current_date + 15,
        'https://rusada.ru/education/online-training/');


-- ============================================================================
-- 16. Календарные планы и сроки отчётов
-- ============================================================================

-- Номера вымышленные, формат как в ЕКП и КП области. Каждое четвёртое без плана: видно предупреждение готовности
update contests c
set calendar_plan = case when l.name = 'Региональное' then 'regional' else 'ekp' end::calendar_plan,
    calendar_plan_number = case when l.name = 'Региональное'
                                then 'КП-' || extract(year from c.starts_on)::integer || '/' || lpad(n.num::text, 3, '0')
                                else 'ЕКП № ' || (2400000 + n.num * 37) end
from (select id, row_number() over (order by id) as num from contests) n, dictionary_contest_levels l
where n.id = c.id and l.id = c.contest_level_id and n.num % 4 <> 0;

-- Приём заявок на ближайшее открытое соревнование закрывается через два дня: напоминание за три дня уже пройдено
update contests set registration_closes_at = now() + interval '2 days 3 hours'
where id = (select id from contests where status = 'registration_open' and starts_on > current_date + 3
            order by id limit 1);

insert into report_deadlines (title, recipient, due_on, description, done_at)
values
  ('Статистический отчёт 5-ФК за год', 'Министерство спорта Оренбургской области',
   make_date(extract(year from current_date)::integer + 1, 1, 20), 'Численность занимающихся и тренеров по форме', null),
  ('Сведения о проведённых соревнованиях за полугодие', 'Министерство спорта Оренбургской области',
   current_date + 5, null, null),
  ('План соревнований на следующий год', 'ФСП России', current_date + 40, null, null),
  ('Отчёт о работе регионального отделения', 'ФСП России', current_date - 10, null, now() - interval '12 days');


-- ============================================================================
-- 17. Правила ЕВСК
-- ============================================================================

-- Официальные нормы ЕВСК по спортивному программированию в открытых правовых базах не нашлись.
-- Это демо-значения с пометкой is_demo: федерация заменяет их в «Правилах ЕВСК» по документам ФСП России
insert into evsk_rules (rank_type_id, contest_level_id, place_to, min_participants, min_age, max_age, source, is_demo)
select pg_temp.dict('dictionary_rank_types', r.rank), pg_temp.dict('dictionary_contest_levels', r.level),
       r.place_to, r.participants, r.min_age, r.max_age, 'Демо-значения до внесения норм ЕВСК ФСП России', true
from (values
  ('Всероссийское', 'Кандидат в мастера спорта', 3, 10, null::integer, null::integer),
  ('Всероссийское', 'Первый спортивный разряд', 8, 10, null, null),
  ('Межрегиональное', 'Первый спортивный разряд', 3, 8, null, null),
  ('Межрегиональное', 'Второй спортивный разряд', 6, 8, null, null),
  ('Региональное', 'Второй спортивный разряд', 3, 6, 14, null),
  ('Региональное', 'Третий спортивный разряд', 6, 6, 14, null),
  ('Региональное', 'Первый юношеский спортивный разряд', 3, 4, null, 17),
  ('Региональное', 'Второй юношеский спортивный разряд', 6, 4, null, 17),
  ('Региональное', 'Третий юношеский спортивный разряд', 10, 4, null, 17)
) r(level, rank, place_to, participants, min_age, max_age);


-- ============================================================================
-- 18. Апелляции и нарушения
-- ============================================================================

-- Заявка участника на соревновании по почте; place из протокола попадает в апелляцию как «текущее место»
create function pg_temp.entry(code text, who text) returns integer language sql as $$
  select e.application from seed_entries e where e.contest = code and who = any(e.members) limit 1
$$;

-- Подана: Виноградова просит второе место по логу проверяющей системы. На рассмотрении: Смирнов на «Первом коде».
-- Отклонена: Фёдорова на первенстве Орска. Удовлетворена: Белова на чемпионате — место уже исправлено в протоколе
insert into appeals (id, contest_id, application_id, filed_by, current_place, requested_place, reason, evidence_url,
                     status, reviewer_id, decision, decided_by, decided_at, created_at)
select gen_random_uuid(), sc.id, pg_temp.entry(a.contest, a.login), pg_temp.user_id(a.login || '@example.test'),
       a.current_place, a.requested_place, a.reason, a.url, a.status::appeal_status,
       case when a.status <> 'submitted' then pg_temp.user_id('federation@example.test') end,
       a.decision,
       case when a.status in ('upheld', 'rejected') then pg_temp.user_id('federation@example.test') end,
       case when a.status in ('upheld', 'rejected') then now() - make_interval(days => a.days_ago - 2) end,
       now() - make_interval(days => a.days_ago)
from (values
  ('lyceum', '14-17-10-11.6', 3, 2, 'Задача D засчитана после перепроверки, но в протокол попало первоначальное значение. Лог проверяющей системы прилагаю.',
   null, 'submitted', null, 3),
  ('first-code', 'u14-1-4.1', 4, 3, 'У третьего места и у меня одинаковое число задач, штраф по времени у меня меньше.',
   'https://disk.yandex.ru/d/first-code-replay', 'reviewing', null, 6),
  ('orsk-open', 'pupil2', 8, 6, 'Прошу пересчитать штрафное время по задаче F.',
   null, 'rejected', 'Штрафное время пересчитано по журналу посылок: место подтверждено.', 50),
  ('alg-championship', 'athlete.minor', 11, 10, 'При переносе таблицы перепутаны строки 10 и 11.',
   null, 'upheld', 'Ошибка переноса из таблицы подтверждена: место исправлено с 11 на 10.', 110)
) a(contest, login, current_place, requested_place, reason, url, status, decision, days_ago)
join seed_contests sc on sc.code = a.contest;

insert into appeal_files (appeal_id, file_id)
select a.id, pg_temp.file('evidence/appeal-lyceum-log.pdf', false, '14-17-10-11.6@example.test')
from appeals a join seed_contests sc on sc.id = a.contest_id where sc.code = 'lyceum';

-- Рапорт главного судьи ждёт решения. Гусев отстранён на 90 дней: его нет в рейтинге, заявки не принимаются.
-- Предупреждение Захаровой на весеннем кубке
insert into violations (id, contest_id, application_id, user_id, reported_by, description, status, sanction,
                        suspended_until, decision, decided_by, decided_at, created_at)
select gen_random_uuid(), sc.id, pg_temp.entry(v.contest, v.login), pg_temp.user_id(v.login || '@example.test'),
       pg_temp.user_id(v.reporter), v.description, v.status::violation_status, v.sanction::sanction,
       case when v.sanction = 'suspension' then current_date + 90 end,
       v.decision,
       case when v.status <> 'reported' then pg_temp.user_id('federation@example.test') end,
       case when v.status <> 'reported' then now() - make_interval(days => v.days_ago - 3) end,
       now() - make_interval(days => v.days_ago)
from (values
  ('ai-olympiad', '14-17-10-11.6', 'judge@example.test',
   'Во втором туре у участника открыт сторонний чат на втором мониторе. Снимок экрана наблюдателя прилагаю.',
   'reported', null, null, 2),
  ('alg-pfo-cup', 'athlete.third', 'federation@example.test',
   'Решения задач B и E совпадают с решениями другого участника до имён переменных: заключение антиплагиата.',
   'decided', 'suspension', 'Нарушение правил честной борьбы подтверждено. Отстранение на 90 дней.', 20),
  ('spring-product-cup', '18-stud.4', 'coach.judge@example.test',
   'Подсказки соседней команде во время защиты после замечания судьи.',
   'decided', 'warning', 'Предупреждение. При повторе — техническое поражение.', 140)
) v(contest, login, reporter, description, status, sanction, decision, days_ago)
join seed_contests sc on sc.code = v.contest;

insert into violation_files (violation_id, file_id)
select v.id, pg_temp.file('evidence/violation-ai-olympiad.pdf', false, 'judge@example.test')
from violations v join seed_contests sc on sc.id = v.contest_id where sc.code = 'ai-olympiad';


-- ============================================================================
-- 19. Спортивная подготовка: программы, группы, журнал занятий, нормативы ФССП
-- ============================================================================

-- Программы подготовки организаций: дисциплина × этап. Действуют с сентября три года назад.
-- У спортшколы — все шесть дисциплин ФССП на начальном и учебно-тренировочном этапах
insert into organization_programs (organization_id, discipline_id, stage, valid_from)
select o.id, pg_temp.dict('dictionary_disciplines', p.discipline), p.stage::training_stage,
       make_date(extract(year from current_date)::integer - 3, 9, 1)
from (
  select 'СШ «Цифровой спорт»' as org, d.name as discipline, s.stage
  from dictionary_disciplines d, unnest(array['initial', 'training']) s(stage)
  where d.name in ('Алгоритмическое программирование', 'Продуктовое программирование',
                   'Программирование систем информационной безопасности', 'Программирование систем искусственного интеллекта',
                   'Программирование робототехники', 'Программирование беспилотных авиационных систем')
  union all
  select * from (values
    ('СШ «Цифровой спорт»', 'Алгоритмическое программирование', 'improvement'),
    ('Лицей № 1', 'Алгоритмическое программирование', 'initial'),
    ('Лицей № 1', 'Продуктовое программирование', 'training'),
    ('Гимназия № 3', 'Алгоритмическое программирование', 'initial'),
    ('ОГУ', 'Алгоритмическое программирование', 'improvement'),
    ('ОГУ', 'Алгоритмическое программирование', 'highest'),
    ('ОГУ', 'Продуктовое программирование', 'improvement'),
    ('ОГУ', 'Программирование систем информационной безопасности', 'improvement'),
    ('ОКИТ', 'Продуктовое программирование', 'training'),
    ('ОКИТ', 'Программирование робототехники', 'initial'),
    ('ОКИТ', 'Программирование систем искусственного интеллекта', 'training'),
    ('Клуб «Байт»', 'Алгоритмическое программирование', 'initial')
  ) v(org, discipline, stage)
) p
join organizations o on o.short_name = p.org;

-- Закрытая программа: у гимназии была робототехника, её свернули год назад — видно в истории
insert into organization_programs (organization_id, discipline_id, stage, valid_from, valid_to)
select o.id, pg_temp.dict('dictionary_disciplines', 'Программирование робототехники'), 'initial',
       make_date(extract(year from current_date)::integer - 3, 9, 1), current_date - 365
from organizations o where o.short_name = 'Гимназия № 3';

-- Тренеры-преподаватели. Тренеров работает в спортшколе и лицее, Зайцева — в колледже и спортшколе
insert into organization_coaches (organization_id, coach_id, position, valid_from)
select o.id, pg_temp.user_id(c.coach), c.position, current_date - c.days
from (values
  ('СШ «Цифровой спорт»', 'coach@example.test', 'Старший тренер-преподаватель', 1100),
  ('Лицей № 1', 'coach@example.test', 'Тренер-преподаватель', 800),
  ('ОГУ', 'athlete.coach@example.test', 'Тренер-преподаватель', 900),
  ('ОКИТ', 'coach.judge@example.test', 'Тренер-преподаватель', 1000),
  ('СШ «Цифровой спорт»', 'coach.judge@example.test', 'Тренер-преподаватель', 700)
) c(org, coach, position, days)
join organizations o on o.short_name = c.org;

-- Учебно-тренировочные группы по этапам. age — сколько лет назад набрана группа
insert into training_groups (organization_id, discipline_id, stage, coach_id, name, start_year)
select o.id, pg_temp.dict('dictionary_disciplines', g.discipline), g.stage::training_stage, pg_temp.user_id(g.coach), g.name,
       extract(year from current_date)::integer - g.age
from (values
  ('СШ «Цифровой спорт»', 'НП-1 · алгоритмика', 'Алгоритмическое программирование', 'initial', 'coach@example.test', 1),
  ('СШ «Цифровой спорт»', 'УТ-2 · алгоритмика', 'Алгоритмическое программирование', 'training', 'coach@example.test', 2),
  ('СШ «Цифровой спорт»', 'ССМ · алгоритмика', 'Алгоритмическое программирование', 'improvement', 'coach@example.test', 3),
  ('СШ «Цифровой спорт»', 'УТ-1 · информационная безопасность', 'Программирование систем информационной безопасности', 'training', 'coach.judge@example.test', 1),
  ('Лицей № 1', 'НП-2 · алгоритмика', 'Алгоритмическое программирование', 'initial', 'coach@example.test', 2),
  ('ОГУ', 'ССМ · алгоритмика ОГУ', 'Алгоритмическое программирование', 'improvement', 'athlete.coach@example.test', 2),
  ('ОГУ', 'ВСМ · алгоритмика ОГУ', 'Алгоритмическое программирование', 'highest', 'athlete.coach@example.test', 3),
  ('ОГУ', 'ССМ · продуктовое ОГУ', 'Продуктовое программирование', 'improvement', 'athlete.coach@example.test', 1),
  ('ОКИТ', 'УТ-2 · продуктовое', 'Продуктовое программирование', 'training', 'coach.judge@example.test', 2),
  ('ОКИТ', 'НП-1 · робототехника', 'Программирование робототехники', 'initial', 'coach.judge@example.test', 1)
) g(org, name, discipline, stage, coach, age)
join organizations o on o.short_name = g.org;

-- Зачисления за два года: from/to — дни назад. Ковалёв, Петров и Макаров переведены на следующий этап
-- по итогам аттестации, Волков отчислен. Приказы нумеруются по порядку
create temp table seed_enrollments (login text, grp text, from_days integer, to_days integer, end_reason text);
insert into seed_enrollments values
  ('pupil1', 'УТ-2 · алгоритмика', 700, 120, 'transferred'),
  ('pupil1', 'ССМ · алгоритмика', 120, null, null),
  ('pupil2', 'УТ-2 · алгоритмика', 400, null, null),
  ('pupil3', 'УТ-2 · алгоритмика', 500, null, null),
  ('athlete.minor', 'УТ-2 · алгоритмика', 365, null, null),
  ('athlete.second', 'ССМ · алгоритмика', 300, null, null),
  ('u14-5-9.1', 'НП-1 · алгоритмика', 730, 365, 'transferred'),
  ('u14-5-9.1', 'УТ-2 · алгоритмика', 365, null, null),
  ('u14-5-9.2', 'НП-1 · алгоритмика', 600, null, null),
  ('u14-1-4.1', 'НП-1 · алгоритмика', 400, null, null),
  ('u14-1-4.2', 'НП-1 · алгоритмика', 300, null, null),
  ('u14-1-4.3', 'НП-2 · алгоритмика', 500, null, null),
  ('u14-1-4.4', 'НП-2 · алгоритмика', 200, null, null),
  ('u14-5-9.3', 'НП-1 · робототехника', 400, null, null),
  ('u14-5-9.4', 'НП-1 · робототехника', 300, null, null),
  ('14-17-5-9.1', 'УТ-1 · информационная безопасность', 400, null, null),
  ('14-17-5-9.2', 'УТ-2 · продуктовое', 500, null, null),
  ('14-17-5-9.3', 'УТ-2 · продуктовое', 500, 60, 'expelled'),
  ('14-17-10-11.1', 'ССМ · алгоритмика ОГУ', 400, null, null),
  ('14-17-10-11.2', 'ССМ · алгоритмика ОГУ', 400, null, null),
  ('14-17-10-11.3', 'ССМ · продуктовое ОГУ', 300, null, null),
  ('18-stud.1', 'ССМ · алгоритмика ОГУ', 700, 250, 'transferred'),
  ('18-stud.1', 'ВСМ · алгоритмика ОГУ', 250, null, null),
  ('18-stud.3', 'ВСМ · алгоритмика ОГУ', 600, null, null),
  ('athlete', 'ВСМ · алгоритмика ОГУ', 500, null, null);

insert into group_enrollments (id, group_id, athlete_id, valid_from, valid_to, end_reason, order_number, note, actor_id, created_at)
select gen_random_uuid(), g.id, pg_temp.user_id(e.login || '@example.test'), current_date - e.from_days,
       case when e.to_days is not null then current_date - e.to_days end, e.end_reason::enrollment_end,
       '№ ' || (100 + row_number() over (order by e.from_days desc, e.login)) || '-с',
       case when e.end_reason = 'expelled' then 'По заявлению родителей: переезд в другой город' end,
       g.coach_id, now() - make_interval(days => e.from_days)
from seed_enrollments e join training_groups g on g.name = e.grp;

update group_enrollments n set previous_id = p.id
from group_enrollments p
where p.athlete_id = n.athlete_id and p.end_reason = 'transferred' and p.valid_to = n.valid_from and p.id <> n.id;

-- Спортивный профиль следует за группой, как при зачислении в приложении: этап, организация, дисциплина,
-- год начала занятий не позже первого зачисления
create temp table seed_current as
select e.athlete_id, g.organization_id, g.stage, e.valid_from as since
from group_enrollments e join training_groups g on g.id = e.group_id where e.valid_to is null;

update athlete_profiles p set training_stage = c.stage, organization_id = c.organization_id, no_organization = false
from seed_current c where c.athlete_id = p.user_id;

update athlete_profiles p set start_year = least(p.start_year, extract(year from f.first)::integer)
from (select athlete_id, min(valid_from) as first from group_enrollments group by athlete_id) f
where f.athlete_id = p.user_id;

update athlete_organizations a set organization_id = c.organization_id
from seed_current c
where a.user_id = c.athlete_id and a.valid_to is null and a.organization_id is distinct from c.organization_id
  and a.valid_from >= c.since;

insert into athlete_organizations (user_id, organization_id, valid_from)
select c.athlete_id, c.organization_id, c.since
from seed_current c join athlete_organizations a on a.user_id = c.athlete_id and a.valid_to is null
where a.organization_id is distinct from c.organization_id;

update athlete_organizations a set valid_to = c.since
from seed_current c
where a.user_id = c.athlete_id and a.valid_to is null and a.organization_id is distinct from c.organization_id
  and a.valid_from < c.since;

create temp table seed_group_disciplines as
select e.athlete_id, g.discipline_id, min(e.valid_from) as since
from group_enrollments e join training_groups g on g.id = e.group_id
group by e.athlete_id, g.discipline_id;

update athlete_disciplines d set valid_from = least(d.valid_from, x.since)
from seed_group_disciplines x
where d.user_id = x.athlete_id and d.discipline_id = x.discipline_id and d.valid_to is null;

insert into athlete_disciplines (user_id, discipline_id, valid_from)
select x.athlete_id, x.discipline_id, x.since from seed_group_disciplines x
where not exists (select 1 from athlete_disciplines d
                  where d.user_id = x.athlete_id and d.discipline_id = x.discipline_id and d.valid_to is null);

-- Журнал: по восемь занятий за последние два месяца у каждой группы. Каждое третье — онлайн
-- со ссылкой на запись. Посещаемость около 85 %
insert into training_sessions (id, group_id, held_on, topic, format, proof_url, created_by, created_at)
select gen_random_uuid(), g.id, current_date - 7 * k - g.id % 3,
       (array['Разбор задач прошлого тура', 'Виртуальный контест с разбором', 'Теория: структуры данных',
              'Командная тактика на соревновании', 'ОФП: челночный бег и пресс', 'Тренировка печати вслепую',
              'Работа над ошибками в решениях', 'Подготовка к ближайшему соревнованию'])[(k + g.id) % 8 + 1],
       case when k % 3 = 0 then 'online' else 'offline' end::session_format,
       case when k % 3 = 0 then 'https://disk.yandex.ru/d/fsp-training-' || g.id || '-' || k end,
       g.coach_id, now() - make_interval(days => 7 * k)
from training_groups g, generate_series(1, 8) k;

insert into session_attendance (session_id, athlete_id, present)
select s.id, e.athlete_id, abs(hashtext(s.id::text || e.athlete_id::text)) % 100 < 85
from training_sessions s
join group_enrollments e on e.group_id = s.group_id and e.valid_from <= s.held_on
                         and (e.valid_to is null or e.valid_to > s.held_on);

-- Нормативы ФССП по спортивному программированию: приказ Минспорта России от 24.06.2025 № 445
-- (рег. Минюст 21.07.2025 № 82991, действует с 01.01.2026), приложения 6–9. Значения перенесены из приказа.
-- «мин, с» хранятся в секундах: 6.20 → 380. Группа A — алгоритмика и робототехника, B — продуктовое,
-- информационная безопасность и БАС; на этапах ССМ и ВСМ нормативы общие для всех дисциплин
create temp table seed_norms (
  stage text, kind text, name text, unit text, direction text, male numeric, female numeric, disc text, ord integer,
  appendix integer
);
insert into seed_norms values
  ('initial', 'ofp', 'Бег на 30 м', 'seconds', 'lower', 6.3, 6.5, 'A', 1, 6),
  ('initial', 'ofp', 'Бег 1000 м', 'min_sec', 'lower', 380, 400, 'A', 2, 6),
  ('initial', 'ofp', 'Наклон вперёд из положения стоя на гимнастической скамье (от уровня скамьи)', 'centimeters', 'higher', 2, 3, 'A', 3, 6),
  ('initial', 'ofp', 'Челночный бег 3×10 м', 'seconds', 'lower', 9.7, 10.1, 'A', 4, 6),
  ('initial', 'ofp', 'Поднимание туловища из положения лёжа на спине (за 1 мин)', 'times', 'higher', 26, 23, 'A', 5, 6),
  ('initial', 'sfp', 'Тест по печати произвольного текста на клавиатуре (за 1 мин)', 'chars', 'higher', 180, 160, 'A', 6, 6),
  ('initial', 'ofp', 'Бег на 30 м', 'seconds', 'lower', 5.8, 6.1, 'B', 11, 6),
  ('initial', 'ofp', 'Бег 1500 м', 'min_sec', 'lower', 510, 550, 'B', 12, 6),
  ('initial', 'ofp', 'Наклон вперёд из положения стоя на гимнастической скамье (от уровня скамьи)', 'centimeters', 'higher', 3, 4, 'B', 13, 6),
  ('initial', 'ofp', 'Челночный бег 3×10 м', 'seconds', 'lower', 9.2, 9.6, 'B', 14, 6),
  ('initial', 'ofp', 'Поднимание туловища из положения лёжа на спине (за 1 мин)', 'times', 'higher', 31, 27, 'B', 15, 6),
  ('initial', 'sfp', 'Тест по печати произвольного текста на клавиатуре (за 1 мин)', 'chars', 'higher', 190, 170, 'B', 16, 6),
  ('training', 'ofp', 'Бег на 60 м', 'seconds', 'lower', 10.2, 10.7, 'A', 21, 7),
  ('training', 'ofp', 'Бег на 1500 м', 'min_sec', 'lower', 475, 495, 'A', 22, 7),
  ('training', 'ofp', 'Наклон вперёд из положения стоя на гимнастической скамье (от уровня скамьи)', 'centimeters', 'higher', 5, 6, 'A', 23, 7),
  ('training', 'ofp', 'Челночный бег 3×10 м', 'seconds', 'lower', 8.5, 8.9, 'A', 24, 7),
  ('training', 'ofp', 'Поднимание туловища из положения лёжа на спине (за 1 мин)', 'times', 'higher', 37, 31, 'A', 25, 7),
  ('training', 'sfp', 'Тест по печати произвольного текста на клавиатуре (за 1 мин)', 'chars', 'higher', 220, 190, 'A', 26, 7),
  ('training', 'ofp', 'Бег на 60 м', 'seconds', 'lower', 9.1, 10.2, 'B', 31, 7),
  ('training', 'ofp', 'Бег на 2000 м', 'min_sec', 'lower', 567, 687, 'B', 32, 7),
  ('training', 'ofp', 'Наклон вперёд из положения стоя на гимнастической скамье (от уровня скамьи)', 'centimeters', 'higher', 6, 8, 'B', 33, 7),
  ('training', 'ofp', 'Челночный бег 3×10 м', 'seconds', 'lower', 7.7, 8.7, 'B', 34, 7),
  ('training', 'ofp', 'Поднимание туловища из положения лёжа на спине (за 1 мин)', 'times', 'higher', 40, 35, 'B', 35, 7),
  ('training', 'sfp', 'Тест по печати произвольного текста на клавиатуре (за 1 мин)', 'chars', 'higher', 240, 210, 'B', 36, 7),
  ('improvement', 'ofp', 'Бег на 60 м', 'seconds', 'lower', 8.1, 9.5, null, 41, 8),
  ('improvement', 'ofp', 'Бег на 2000 м', 'min_sec', 'lower', 480, 595, null, 42, 8),
  ('improvement', 'ofp', 'Наклон вперёд из положения стоя на гимнастической скамье (от уровня скамьи)', 'centimeters', 'higher', 11, 15, null, 43, 8),
  ('improvement', 'ofp', 'Поднимание туловища из положения лёжа на спине (за 1 мин)', 'times', 'higher', 50, 44, null, 44, 8),
  ('improvement', 'sfp', 'Тест по печати произвольного текста на клавиатуре (за 1 мин)', 'chars', 'higher', 260, 230, null, 45, 8),
  ('highest', 'ofp', 'Бег на 100 м', 'seconds', 'lower', 13.2, 15.8, null, 51, 9),
  ('highest', 'ofp', 'Бег на 2000 м', 'min_sec', 'lower', null, 585, null, 52, 9),
  ('highest', 'ofp', 'Бег на 3000 м', 'min_sec', 'lower', 740, null, null, 53, 9),
  ('highest', 'ofp', 'Наклон вперёд из положения стоя на гимнастической скамье (от уровня скамьи)', 'centimeters', 'higher', 13, 16, null, 54, 9),
  ('highest', 'ofp', 'Поднимание туловища из положения лёжа на спине (за 1 мин)', 'times', 'higher', 51, 45, null, 55, 9),
  ('highest', 'sfp', 'Тест по печати произвольного текста на клавиатуре (за 1 мин)', 'chars', 'higher', 300, 270, null, 56, 9);

insert into standard_norms (stage, kind, name, unit, direction, threshold_male, threshold_female, source, is_demo, sort_order)
select n.stage::training_stage, n.kind::norm_kind, n.name, n.unit::norm_unit, n.direction::norm_direction, n.male, n.female,
       'Приказ Минспорта России от 24.06.2025 № 445, приложение № ' || n.appendix, false, n.ord
from seed_norms n order by n.ord;

insert into standard_norm_disciplines (norm_id, discipline_id)
select s.id, pg_temp.dict('dictionary_disciplines', d.name)
from seed_norms n
join standard_norms s on s.sort_order = n.ord
join (values
  ('A', 'Алгоритмическое программирование'), ('A', 'Программирование робототехники'),
  ('B', 'Продуктовое программирование'), ('B', 'Программирование систем информационной безопасности'),
  ('B', 'Программирование беспилотных авиационных систем')
) d(disc, name) on d.disc = n.disc;

-- Результат сдачи относительно порога: ok — с запасом лучше порога, иначе с запасом хуже
create function pg_temp.norm_value(threshold numeric, direction text, unit text, ok boolean) returns numeric
language sql as $$
  select case
    when direction = 'higher' and ok then ceil(threshold * 1.08)
    when direction = 'higher' then greatest(floor(threshold * 0.85), 0)
    when ok and unit = 'seconds' then round(threshold * 0.95, 1)
    when ok then round(threshold * 0.95)
    when unit = 'seconds' then round(threshold * 1.1, 1)
    else round(threshold * 1.1) end
$$;

-- Нормативы этапа сдают при каждом зачислении, за неделю до приказа — все выполнены.
-- Нормативы следующего этапа в этом сезоне: Фёдорова, Козлова и Павлов выполнили всё и готовы к переводу,
-- у Ахмедова, Беловой, Смирнова и Медведевой часть нормативов не выполнена
create temp table seed_norm_plan (login text, days integer, all_ok boolean);
insert into seed_norm_plan values
  ('pupil2', 40, true), ('u14-5-9.2', 35, true), ('14-17-10-11.1', 50, true),
  ('pupil3', 45, false), ('athlete.minor', 30, false), ('u14-1-4.1', 25, false), ('14-17-5-9.2', 60, false);

insert into norm_results (id, athlete_id, norm_id, value, threshold, passed, passed_on, recorded_by, created_at)
select gen_random_uuid(), x.athlete_id, n.id, v.value, l.threshold,
       case when n.direction = 'higher' then v.value >= l.threshold else v.value <= l.threshold end,
       x.on_date, x.coach_id, x.on_date + time '12:00'
from (
  select e.athlete_id, g.stage, g.discipline_id, e.valid_from - 7 as on_date, g.coach_id, true as all_ok
  from group_enrollments e join training_groups g on g.id = e.group_id
  union all
  select c.athlete_id,
         (case g.stage when 'initial' then 'training' when 'training' then 'improvement' else 'highest' end)::training_stage,
         g.discipline_id, current_date - p.days, g.coach_id, p.all_ok
  from seed_norm_plan p
  join group_enrollments c on c.athlete_id = pg_temp.user_id(p.login || '@example.test') and c.valid_to is null
  join training_groups g on g.id = c.group_id
) x
join standard_norms n on n.stage = x.stage
  and (not exists (select 1 from standard_norm_disciplines d where d.norm_id = n.id)
       or exists (select 1 from standard_norm_disciplines d where d.norm_id = n.id and d.discipline_id = x.discipline_id))
join athlete_profiles ap on ap.user_id = x.athlete_id
cross join lateral (select case when ap.sex = 'female' then n.threshold_female else n.threshold_male end as threshold) l
cross join lateral (select pg_temp.norm_value(l.threshold, n.direction::text, n.unit::text,
                                              x.all_ok or n.sort_order % 3 <> 0) as value) v
where l.threshold is not null;

-- Аттестации: переводы по закрытым зачислениям и одна — «оставлен на этапе»
insert into attestations (id, athlete_id, group_id, target_group_id, stage_from, stage_to, result, decided_on,
                          order_number, comment, actor_id, created_at)
select gen_random_uuid(), p.athlete_id, p.group_id, n.group_id, gp.stage, gn.stage, 'transferred', p.valid_to,
       n.order_number, 'Нормативы следующего этапа выполнены', gp.coach_id, p.valid_to + time '15:00'
from group_enrollments p
join group_enrollments n on n.previous_id = p.id
join training_groups gp on gp.id = p.group_id
join training_groups gn on gn.id = n.group_id;

insert into attestations (id, athlete_id, group_id, stage_from, result, decided_on, comment, actor_id, created_at)
select gen_random_uuid(), pg_temp.user_id('pupil3@example.test'), g.id, g.stage, 'retained', current_date - 120,
       'Не выполнены наклон и челночный бег — пересдача в следующем сезоне', g.coach_id, now() - interval '120 days'
from training_groups g where g.name = 'УТ-2 · алгоритмика';
