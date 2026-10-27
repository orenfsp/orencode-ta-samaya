const zone = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Yekaterinburg',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const parse = (day: string) => new Date(`${day}T12:00:00Z`)
const iso = (date: Date) => date.toISOString().slice(0, 10)
const shortDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function todayOrenburg() {
  const parts = zone.formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function monthBounds(month: string) {
  const [year, number] = month.split('-').map(Number)
  return [iso(new Date(Date.UTC(year!, number! - 1, 1))), iso(new Date(Date.UTC(year!, number!, 0)))] as const
}

export const moveMonth = (month: string, offset: number) => {
  const date = parse(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return iso(date).slice(0, 7)
}

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    parse(`${month}-01`),
  )

export const dayLabel = (day: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(parse(day))

const time = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Yekaterinburg',
  hour: '2-digit',
  minute: '2-digit',
})
const zoned = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Yekaterinburg',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

type Dated = {
  start_date?: string
  end_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

/** «5 нояб. 2026 г., 18:00–20:00» или «1 дек. 2026 г., 09:00 — 5 дек. 2026 г., 18:00» — время по Оренбургу */
export const eventDates = (event: Dated) => {
  if (event.starts_at && event.ends_at) {
    const [start, end] = [new Date(event.starts_at), new Date(event.ends_at)]
    const [startDay, endDay] = [zoned.format(start), zoned.format(end)]
    return startDay === endDay
      ? `${startDay}, ${time.format(start)}–${time.format(end)}`
      : `${startDay}, ${time.format(start)} — ${endDay}, ${time.format(end)}`
  }
  const start = shortDate.format(parse(event.start_date!))
  return event.end_date && event.end_date !== event.start_date
    ? `${start} — ${shortDate.format(parse(event.end_date))}`
    : start
}

export function calendarDays(month: string) {
  const [first, last] = monthBounds(month)
  const start = parse(first)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = parse(last)
  end.setUTCDate(end.getUTCDate() + (6 - ((end.getUTCDay() + 6) % 7)))
  const days: string[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(iso(cursor))
  }
  return days
}

const plateMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'Asia/Yekaterinburg' })
const plateWeekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Yekaterinburg' })

/** Листок календаря: «14», «нояб.», «чт», время «18:00» — по Оренбургу */
export function datePlate(event: Dated) {
  const start = event.starts_at ? new Date(event.starts_at) : parse(event.start_date!)
  const parts = zone.formatToParts(start)
  return {
    day: String(Number(parts.find((part) => part.type === 'day')!.value)),
    month: plateMonth.format(start).replace('.', ''),
    weekday: plateWeekday.format(start),
    time: event.starts_at ? time.format(start) : null,
  }
}
