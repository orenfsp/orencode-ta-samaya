const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const number = new Intl.NumberFormat('ru-RU')

type DateInput = Date | string | number

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value))

/** «13 октября 2026» — для текста */
export const formatDateLong = (value: DateInput) => longDate.format(toDate(value)).replace(/\s?г\.$/, '')

/** «25 июня» — для строк событий */
export const formatDayMonth = (value: DateInput) => dayMonth.format(toDate(value))

/** «09.10.2026» — для карточек и таблиц */
export const formatDate = (value: DateInput) => shortDate.format(toDate(value))

export const formatDateTime = (value: DateInput) => dateTime.format(toDate(value))

/** «10 000» с неразрывным пробелом */
export const formatNumber = (value: number) => number.format(value)

/** plural(5, ['заявка', 'заявки', 'заявок']) → «заявок» */
export function plural(count: number, forms: readonly [one: string, few: string, many: string]) {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}

/** «Иванов Пётр Сергеевич» → «ИП» */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
