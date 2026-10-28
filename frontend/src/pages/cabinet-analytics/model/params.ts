import { useSearchParams } from 'react-router'
import type { AnalyticsQuery } from '@/entities/analytics'
import { orenburgDay } from '@/shared/lib'

export type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom'

export const presets: { value: PeriodPreset; label: string }[] = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
  { value: 'custom', label: 'Свои даты' },
]

const isPreset = (value: string | null): value is PeriodPreset => presets.some((item) => item.value === value)

/** Первое число месяца, отстоящего на back месяцев от месяца today */
function monthStart(today: string, back: number) {
  const [year, month] = today.split('-').map(Number)
  const index = year * 12 + (month - 1) - back
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
}

/** Период пресета: текущий месяц, три месяца или двенадцать, включая текущий */
function presetRange(preset: Exclude<PeriodPreset, 'custom'>) {
  const today = orenburgDay(new Date())
  const back = { month: 0, quarter: 2, year: 11 }[preset]
  return { date_from: monthStart(today, back), date_to: today }
}

/** Фильтры аналитики живут в адресе: ссылкой можно поделиться */
export function useAnalyticsParams() {
  const [params, setParams] = useSearchParams()
  const value = (key: string) => params.get(key) ?? ''
  const raw = params.get('period')
  const preset: PeriodPreset = isPreset(raw) ? raw : 'year'
  const kind = value('group_kind') === 'academic' ? 'academic' : value('group_kind') === 'age' ? 'age' : ''

  // Перепутанные даты своего периода меняем местами, а не показываем ошибку на всю страницу
  const [from, to] = [value('from'), value('to')].sort((a, b) => (a && b ? a.localeCompare(b) : 0))
  const range =
    preset === 'custom' ? { date_from: from || undefined, date_to: to || undefined } : presetRange(preset)
  const query: AnalyticsQuery = {
    ...range,
    discipline_id: value('discipline_id') || undefined,
    municipality_id: value('municipality_id') || undefined,
    group_kind: kind || undefined,
    group_id: kind ? value('group_id') || undefined : undefined,
  }

  const update = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, item] of Object.entries(changes)) {
          if (item) next.set(key, item)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )

  const filtered = Boolean(query.discipline_id || query.municipality_id || query.group_kind)
  const reset = () => setParams(preset === 'year' ? {} : { period: preset }, { replace: true })

  return { query, preset, values: { from: value('from'), to: value('to') }, update, filtered, reset }
}
