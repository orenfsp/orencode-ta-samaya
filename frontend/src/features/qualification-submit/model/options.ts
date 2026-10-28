import type { AnyDictionaryItem } from '@/entities/dictionary'
import { isValidNow, type Qualification } from '@/entities/qualification'

export const DOCUMENT_ACCEPT =
  'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx'

/** Полных лет на сегодня по дате рождения YYYY-MM-DD */
export function ageToday(birthDate: string | null | undefined) {
  if (!birthDate) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  const now = new Date()
  const passed = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day)
  return now.getFullYear() - year - (passed ? 0 : 1)
}

/**
 * В справочнике выше стоит более высокая ступень: подать можно только выше действующей.
 * Сравниваем по месту в списке, а не по id: новые записи справочника встают в конец.
 * Разряд с минимальным возрастом старше спортсмена недоступен и подписан.
 */
export function itemOptions(items: AnyDictionaryItem[], current: Qualification | null, age: number | null) {
  const held =
    current && isValidNow(current.valid_until) ? items.findIndex((item) => item.id === current.item_id) : -1
  return items.map((item, index) => {
    const minAge = 'min_age' in item ? item.min_age : null
    const young = age != null && minAge != null && age < minAge
    return {
      value: String(item.id),
      label: young ? `${item.name} · с ${minAge} лет` : item.name,
      disabled: (held >= 0 && index >= held) || young,
    }
  })
}
