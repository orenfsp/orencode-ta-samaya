/** Даты соревнований — дни без времени, моменты регистрации — по Оренбургу */
const zone = 'Asia/Yekaterinburg'

const card = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})
const text = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const moment = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: zone,
})

const day = (value: string) => new Date(`${value}T12:00:00Z`)

/** «09.10.2026» или «09.10.2026 — 10.10.2026» — для карточек */
export function competitionDates(competition: { starts_on: string; ends_on: string }) {
  const start = card.format(day(competition.starts_on))
  return competition.ends_on !== competition.starts_on
    ? `${start} — ${card.format(day(competition.ends_on))}`
    : start
}

/** «13 октября 2026» — для текста */
export const longDay = (value: string) => text.format(day(value)).replace(/\s?г\.$/, '')

/** «1 ноября, 00:00» по Оренбургу */
export const formatMoment = (iso: string) => moment.format(new Date(iso))
