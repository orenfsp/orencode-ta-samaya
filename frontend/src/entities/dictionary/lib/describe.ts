import { plural } from '@/shared/lib'
import type { AnyDictionaryItem } from '../model/types'

const years = (count: number) => `${count} ${plural(count, ['год', 'года', 'лет'])}`

/** «24» → «2 года», «18» → «18 месяцев» */
export function formatMonths(months: number) {
  if (months % 12 === 0) return years(months / 12)
  return `${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`
}

/** Границы возрастной группы человеческим языком: «до 13 лет», «14–17 лет», «от 18 лет» */
export function formatAgeRange(min: number | null | undefined, max: number | null | undefined) {
  if (min != null && max != null) return `${min}–${max} ${plural(max, ['год', 'года', 'лет'])}`
  if (min != null) return `от ${years(min)}`
  if (max != null) return `до ${years(max)}`
  return 'без ограничений'
}

/** Короткие метки правил записи для таблицы: возраст, срок, пожизненно */
export function describeRules(item: AnyDictionaryItem): string[] {
  const chips: string[] = []
  if ('rank_kind' in item && item.rank_kind) {
    if (item.min_age != null) chips.push(`с ${years(item.min_age)}`)
    chips.push(
      item.is_lifetime ? 'пожизненно' : item.validity_months ? formatMonths(item.validity_months) : '',
    )
    if (item.valid_until_age != null) chips.push(`до ${years(item.valid_until_age)}`)
  } else if ('max_age' in item || 'min_age' in item) {
    chips.push(formatAgeRange(item.min_age, item.max_age))
  } else if ('validity_months' in item) {
    chips.push(item.validity_months ? formatMonths(item.validity_months) : 'бессрочно')
  }
  return chips.filter(Boolean)
}
