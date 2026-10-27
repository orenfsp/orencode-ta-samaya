/** Разбор и маска дат «дд.мм.гггг» и времени «чч:мм» — независимо от языка браузера */

export const MIN_YEAR = 1900
export const MAX_YEAR = 2100

export const monthNames = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

export const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const pad = (value: number) => String(value).padStart(2, '0')

/** Набор цифр → «дд.мм.гггг» с точками по мере ввода */
export function maskDate(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.')
}

export function maskTime(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean).join(':')
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** «дд.мм.гггг» → «гггг-мм-дд» или null, если дата неполная или несуществующая */
export function parseDate(text: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1 || day > daysIn(year, month))
    return null
  return `${year}-${pad(month)}-${pad(day)}`
}

export function parseTime(text: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return text
}

/** «гггг-мм-дд» → «дд.мм.гггг» */
export function formatDateText(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : ''
}

export const toIsoDate = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`

/** 42 клетки месяца с понедельника: соседние месяцы добивают сетку */
export function monthGrid(year: number, month: number) {
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index - offset + 1))
    return {
      iso: toIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
    }
  })
}

export function todayIso() {
  const now = new Date()
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}
