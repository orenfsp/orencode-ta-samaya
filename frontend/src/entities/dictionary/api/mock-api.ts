import { ApiError } from '@/shared/api'
import type { AnyDictionaryItem, DictionaryInfo, DictionaryKey } from '../model/types'
import type { DictionaryApi } from './http-api'

/*
 * Временная подмена API справочников для dev, пока бэк (ветка Ivan-002) не готов.
 * Повторяет контракт docs/004_tz_dictionaries.md: те же ответы, 409 name_taken / in_use и 422 по полям.
 * Данные живут в памяти вкладки и сбрасываются при перезагрузке.
 */

const catalog: DictionaryInfo[] = [
  { key: 'disciplines', title: 'Дисциплины' },
  { key: 'municipalities', title: 'Муниципалитеты' },
  { key: 'organization_types', title: 'Типы организаций' },
  { key: 'academic_groups', title: 'Академические группы' },
  { key: 'age_groups', title: 'Возрастные группы' },
  { key: 'contest_types', title: 'Типы соревнований' },
  { key: 'contest_levels', title: 'Уровни соревнований' },
  { key: 'contest_formats', title: 'Форматы проведения' },
  { key: 'rank_types', title: 'Разряды и звания' },
  { key: 'judge_categories', title: 'Судейские категории' },
  { key: 'judge_positions', title: 'Судейские должности' },
]

type Seed = Partial<AnyDictionaryItem> & { name: string; archived?: boolean }

const names = (...list: string[]): Seed[] => list.map((name) => ({ name }))

const seed: Record<DictionaryKey, Seed[]> = {
  disciplines: [
    {
      name: 'Алгоритмическое программирование',
      description: 'Решение алгоритмических задач на время, индивидуально и в командах',
    },
    {
      name: 'Продуктовое программирование',
      description: 'Командная разработка программного продукта по кейсу с защитой',
    },
    {
      name: 'Программирование систем информационной безопасности',
      description: 'Соревнования в формате CTF',
    },
    {
      name: 'Программирование систем искусственного интеллекта',
      description: 'Задачи машинного обучения и анализа данных',
    },
    {
      name: 'Программирование робототехники',
      description: 'Программирование роботов для выполнения заданий на полигоне',
    },
    {
      name: 'Программирование беспилотных авиационных систем',
      description: 'Программирование автономных полётов БПЛА',
    },
    { name: 'Квизы', description: 'Командные интеллектуальные игры по ИТ-тематике' },
    {
      name: 'Олимпиадное программирование',
      description: 'Старое название алгоритмического программирования',
      archived: true,
    },
  ],
  municipalities: names(
    'г. Оренбург',
    'г. Орск',
    'г. Новотроицк',
    'г. Бузулук',
    'г. Бугуруслан',
    'г. Медногорск',
    'ЗАТО п. Комаровский',
    'Абдулинский городской округ',
    'Гайский городской округ',
    'Кувандыкский городской округ',
    'Соль-Илецкий городской округ',
    'Сорочинский городской округ',
    'Ясненский городской округ',
    'Адамовский район',
    'Акбулакский район',
    'Александровский район',
    'Асекеевский район',
    'Беляевский район',
    'Бугурусланский район',
    'Бузулукский район',
    'Грачёвский район',
    'Домбаровский район',
    'Илекский район',
    'Кваркенский район',
    'Красногвардейский район',
    'Курманаевский район',
    'Матвеевский район',
    'Новоорский район',
    'Новосергиевский район',
    'Октябрьский район',
    'Оренбургский район',
    'Первомайский район',
    'Переволоцкий район',
    'Пономарёвский район',
    'Сакмарский район',
    'Саракташский район',
    'Светлинский район',
    'Северный район',
    'Ташлинский район',
    'Тоцкий район',
    'Тюльганский район',
    'Шарлыкский район',
  ),
  organization_types: [
    { name: 'Общеобразовательная школа' },
    { name: 'Лицей / гимназия' },
    { name: 'Колледж / техникум', description: 'Среднее профессиональное образование' },
    { name: 'Вуз' },
    { name: 'Спортивная школа' },
    { name: 'Спортивный клуб' },
    { name: 'Компания', description: 'Коммерческая организация, в т. ч. организатор соревнований' },
    { name: 'Без организации', description: 'Спортсмен занимается самостоятельно' },
  ],
  academic_groups: names('1–4 классы', '5–9 классы', '10–11 классы', 'Студенты'),
  age_groups: [
    { name: 'До 14 лет', min_age: null, max_age: 13 },
    { name: '14–17 лет', min_age: 14, max_age: 17 },
    { name: '18 лет и старше', min_age: 18, max_age: null },
  ],
  contest_types: [
    { name: 'Чемпионат', description: 'Без ограничения по возрасту' },
    { name: 'Первенство', description: 'Для определённых возрастных групп' },
    { name: 'Кубок' },
    { name: 'Турнир' },
    { name: 'Фестиваль' },
  ],
  contest_levels: [
    { name: 'Региональное', description: 'Чемпионаты и первенства области и иные региональные' },
    { name: 'Межрегиональное', description: 'В том числе окружные (ПФО)' },
    { name: 'Всероссийское', description: 'Чемпионаты, первенства и кубки России' },
    { name: 'Международное' },
  ],
  contest_formats: [
    { name: 'Очно' },
    { name: 'Онлайн' },
    { name: 'Смешанный', description: 'Например, разработка онлайн, защита проектов очно' },
  ],
  rank_types: [
    { name: 'Заслуженный мастер спорта России', rank_kind: 'Спортивное звание', is_lifetime: true },
    { name: 'Мастер спорта России международного класса', rank_kind: 'Спортивное звание', is_lifetime: true },
    { name: 'Мастер спорта России', rank_kind: 'Спортивное звание', min_age: 16, is_lifetime: true },
    { name: 'Кандидат в мастера спорта', rank_kind: 'Спортивный разряд', min_age: 15, validity_months: 36 },
    { name: 'Первый спортивный разряд', rank_kind: 'Спортивный разряд', min_age: 14, validity_months: 24 },
    { name: 'Второй спортивный разряд', rank_kind: 'Спортивный разряд', min_age: 14, validity_months: 24 },
    { name: 'Третий спортивный разряд', rank_kind: 'Спортивный разряд', min_age: 14, validity_months: 24 },
    {
      name: 'Первый юношеский спортивный разряд',
      rank_kind: 'Юношеский разряд',
      min_age: 12,
      validity_months: 24,
      valid_until_age: 18,
    },
    {
      name: 'Второй юношеский спортивный разряд',
      rank_kind: 'Юношеский разряд',
      min_age: 12,
      validity_months: 24,
      valid_until_age: 18,
    },
    {
      name: 'Третий юношеский спортивный разряд',
      rank_kind: 'Юношеский разряд',
      min_age: 12,
      validity_months: 24,
      valid_until_age: 18,
    },
  ],
  judge_categories: [
    { name: 'Спортивный судья всероссийской категории', validity_months: 48 },
    { name: 'Спортивный судья первой категории', validity_months: 48 },
    { name: 'Спортивный судья второй категории', validity_months: 24 },
    { name: 'Спортивный судья третьей категории', validity_months: 24 },
    { name: 'Юный спортивный судья', validity_months: null, archived: true },
  ],
  judge_positions: names(
    'Главный судья',
    'Заместитель главного судьи',
    'Главный секретарь',
    'Заместитель главного секретаря',
    'Судья',
  ),
}

// Значения, которые «уже используются» в других данных: на них мок отвечает 409 in_use при удалении
const used = new Set([
  'Алгоритмическое программирование',
  'г. Оренбург',
  'Очно',
  'Региональное',
  'Кандидат в мастера спорта',
])

const ruleDefaults: Partial<Record<DictionaryKey, Partial<AnyDictionaryItem>>> = {
  age_groups: { min_age: null, max_age: null },
  rank_types: { min_age: null, validity_months: null, is_lifetime: false, valid_until_age: null },
  judge_categories: { validity_months: null },
}

let nextId = 1
const now = () => new Date().toISOString()
const store = Object.fromEntries(
  (Object.keys(seed) as DictionaryKey[]).map((key) => [
    key,
    seed[key].map(({ archived, ...item }) => ({
      ...ruleDefaults[key],
      ...item,
      id: nextId++,
      description: item.description ?? null,
      is_archived: Boolean(archived),
      created_at: now(),
      updated_at: now(),
    })),
  ]),
) as Record<DictionaryKey, AnyDictionaryItem[]>

const wait = () => new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250))

const fail = (
  status: number,
  code: string,
  message: string,
  fields: Record<string, string[]> | null = null,
) => {
  throw new ApiError(status, { error: { code, message, fields } })
}

function find(key: DictionaryKey, id: number) {
  const item = store[key].find((entry) => entry.id === id)
  if (!item) fail(404, 'not_found', 'Запись не найдена')
  return item!
}

function ensureNameFree(key: DictionaryKey, name: string, exceptId?: number) {
  const taken = store[key].some(
    (entry) => !entry.is_archived && entry.id !== exceptId && entry.name.toLowerCase() === name.toLowerCase(),
  )
  if (taken) fail(409, 'name_taken', 'Такое значение уже есть')
}

/** Правила домена из ТЗ — ошибки приходят по полям, как договорились с бэком */
function validate(key: DictionaryKey, item: Partial<AnyDictionaryItem>) {
  const fields: Record<string, string[]> = {}
  if (!item.name?.trim()) fields.name = ['Укажите название']
  else if (item.name.trim().length > 200) fields.name = ['Не длиннее 200 символов']
  if (key === 'age_groups') {
    if (item.min_age == null && item.max_age == null) fields.min_age = ['Укажите хотя бы одну границу']
    if (item.min_age != null && item.max_age != null && item.max_age < item.min_age)
      fields.max_age = ['Не может быть меньше «от»']
  }
  if (key === 'rank_types') {
    if (item.is_lifetime && item.validity_months != null)
      fields.validity_months = ['У пожизненного звания срока нет']
    if (!item.is_lifetime && item.validity_months == null) fields.validity_months = ['Укажите срок действия']
    if (item.rank_kind !== 'Спортивное звание' && item.min_age == null)
      fields.min_age = ['Укажите минимальный возраст']
    if (item.rank_kind !== 'Юношеский разряд' && item.valid_until_age != null)
      fields.valid_until_age = ['Только для юношеских разрядов']
  }
  if (Object.keys(fields).length) fail(422, 'validation_error', 'Проверьте поля формы', fields)
}

export const mockDictionaryApi: DictionaryApi = {
  async catalog() {
    await wait()
    return catalog
  },
  async options(key) {
    await wait()
    return store[key].filter((item) => !item.is_archived)
  },
  async list(key, includeArchived) {
    await wait()
    // Как у бэка: в порядке добавления, новые — в конец
    return store[key].filter((item) => includeArchived || !item.is_archived)
  },
  async create(key, body) {
    await wait()
    const item = { ...ruleDefaults[key], ...body, name: body.name?.trim() ?? '' }
    validate(key, item)
    ensureNameFree(key, item.name)
    const created = {
      ...item,
      id: nextId++,
      description: body.description || null,
      is_archived: false,
      created_at: now(),
      updated_at: now(),
    } as AnyDictionaryItem
    store[key].push(created)
    return created
  },
  async update(key, id, body) {
    await wait()
    const current = find(key, id)
    const next = { ...current, ...body, name: (body.name ?? current.name).trim() }
    validate(key, next)
    if (!next.is_archived) ensureNameFree(key, next.name, id)
    Object.assign(current, next, { updated_at: now() })
    return current
  },
  async remove(key, id) {
    await wait()
    const item = find(key, id)
    if (used.has(item.name)) fail(409, 'in_use', 'Значение используется — его можно только архивировать')
    store[key] = store[key].filter((entry) => entry.id !== id)
  },
  async archive(key, id) {
    await wait()
    return Object.assign(find(key, id), { is_archived: true, updated_at: now() })
  },
  async restore(key, id) {
    await wait()
    const item = find(key, id)
    ensureNameFree(key, item.name, id)
    return Object.assign(item, { is_archived: false, updated_at: now() })
  },
}
