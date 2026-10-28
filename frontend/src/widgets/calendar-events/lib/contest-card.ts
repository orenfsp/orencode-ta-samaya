import type { CalendarItem } from '@/entities/calendar'
import type { CompetitionCardData } from '@/entities/competition'

/** Соревнование из ленты календаря — в форме общей карточки */
export const contestCard = (item: CalendarItem): CompetitionCardData => ({
  id: item.contest_id!,
  title: item.title,
  status: item.status,
  status_title: item.status_title,
  is_verified: item.is_verified,
  discipline: item.discipline,
  starts_on: item.start_date,
  ends_on: item.end_date ?? item.start_date,
  place: item.location,
  is_online: item.is_online,
  groups: item.groups ?? [],
})
