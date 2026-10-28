/** Время площадок — по Оренбургу (UTC+5, без перехода на летнее): в API уходит ISO с «+05:00» */
const OFFSET = '+05:00'
const zone = 'Asia/Yekaterinburg'

const local = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: zone,
})

/** ISO с сервера → «гггг-мм-ддTчч:мм» по Оренбургу для DateTimeInput */
export function toLocalInput(iso: string) {
  const parts = Object.fromEntries(local.formatToParts(new Date(iso)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** «гггг-мм-ддTчч:мм» → ISO с часовым поясом Оренбурга */
export const fromLocalInput = (value: string) => `${value}:00${OFFSET}`

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: zone,
})
const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: zone })
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: zone })
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: zone,
})

/** «27.10.2026, 14:05» по Оренбургу */
export const formatOrenburgDateTime = (iso: string) => dateTime.format(new Date(iso))

/** «14:05» по Оренбургу */
export const formatOrenburgTime = (iso: string) => time.format(new Date(iso))

/** День по Оренбургу «гггг-мм-дд» — ключ для группировки ленты */
export const orenburgDay = (iso: string | Date) => toLocalInput(new Date(iso).toISOString()).slice(0, 10)

/** «Сегодня», «Вчера», «14 октября», «14 октября 2025» — заголовок дня в ленте */
export function orenburgDayLabel(day: string, now = new Date()) {
  const today = orenburgDay(now)
  const yesterday = orenburgDay(new Date(now.getTime() - 86_400_000))
  if (day === today) return 'Сегодня'
  if (day === yesterday) return 'Вчера'
  const date = new Date(`${day}T12:00:00${OFFSET}`)
  const format = day.slice(0, 4) === today.slice(0, 4) ? dayMonth : dayMonthYear
  return format.format(date).replace(/\s?г\.$/, '')
}
