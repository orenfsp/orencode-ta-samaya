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
