import { routes } from '@/shared/config'
import type { AuditEntry } from '../model/types'

/** Подписи полей из payload. Чего нет в словаре — показываем кодом */
const fieldLabels: Record<string, string> = {
  id: 'Номер',
  title: 'Название',
  name: 'Название',
  description: 'Описание',
  status: 'Статус',
  role: 'Роль',
  reason: 'Причина',
  previous: 'Было',
  team_name: 'Команда',
  starts_on: 'Начало',
  ends_on: 'Окончание',
  venue: 'Место',
  discipline_id: 'Дисциплина',
  contest_type_id: 'Тип',
  contest_level_id: 'Уровень',
  contest_format_id: 'Формат',
  participation_type: 'Участие',
  team_size_min: 'Команда от',
  team_size_max: 'Команда до',
  municipality_id: 'Муниципалитет',
  age_group_ids: 'Возрастные группы',
  academic_group_ids: 'Академические группы',
  registration_opens_at: 'Регистрация с',
  registration_closes_at: 'Регистрация до',
  prize_fund_text: 'Призы',
  prize_fund_amount: 'Призовой фонд',
  regulations_file_id: 'Положение',
  photo_file_ids: 'Фото',
  organizer_id: 'Организатор',
  rating_points: 'Баллы за места',
  members: 'Участники',
  contest_id: 'Соревнование',
  user_id: 'Пользователь',
  is_archived: 'В архиве',
}

export const auditFieldLabel = (key: string) => fieldLabels[key] ?? key

/** Значение из payload в одну строку: даты и списки как есть, пустое — тире */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (Array.isArray(value)) return value.length ? value.map(formatAuditValue).join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

type Change = { old: unknown; new: unknown }

const isChange = (value: unknown): value is Change =>
  typeof value === 'object' && value !== null && 'old' in value && 'new' in value

/** Изменения полей: соревнования пишут их в changes, справочники — в values */
export function auditChanges(entry: AuditEntry) {
  for (const key of ['changes', 'values']) {
    const value = entry.payload[key]
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const rows = Object.entries(value)
    if (rows.length && rows.every(([, change]) => isChange(change)))
      return rows.map(([field, change]) => ({ field, label: auditFieldLabel(field), ...(change as Change) }))
  }
  return []
}

/** Остальные поля payload — без изменений, статусов и причины: они показаны отдельно */
export function auditDetails(entry: AuditEntry) {
  const shown = new Set(['changes', 'from', 'to', 'reason'])
  if (auditChanges(entry).length) shown.add('values')
  return Object.entries(entry.payload).filter(([key]) => !shown.has(key))
}

/** Куда ведёт «Открыть» у записи: страница объекта, если она есть */
export function auditObjectLink(entry: AuditEntry): string | undefined {
  const { payload, object_type: type, object_id: id } = entry
  if (entry.action.endsWith('.delete')) return undefined
  if (entry.action.startsWith('dictionary.') && type) return routes.dictionaries(type)
  if (type === 'contest' && typeof payload.id === 'number') return routes.competition(payload.id)
  if (type === 'contest_application') return routes.cabinetCompetitions('federation')
  if (type === 'calendar_event' && id) return `${routes.calendar}/${id}`
  if (type === 'news_article' && id) return routes.newsEdit(id)
  if (type === 'user_role') return routes.cabinetAccounts
  return undefined
}
