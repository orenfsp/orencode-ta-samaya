import { useQuery } from '@tanstack/react-query'
import { request, type Query } from '@/shared/api'
import { todayOrenburg } from '../lib/dates'

/** Что показывает лента календаря: событие ФСП или соревнование */
export type CalendarKind = 'event' | 'contest'

/** Элемент публичной ленты: событие ФСП или действительное соревнование */
export interface CalendarItem {
  kind: CalendarKind
  id: string
  contest_id: number | null
  title: string
  description: string
  start_date: string
  end_date: string | null
  /** Время только у событий ФСП; у соревнований — null */
  starts_at: string | null
  ends_at: string | null
  location: string | null
  is_online: boolean
  registration_url: string | null
  status: string
  status_title: string
  is_verified: boolean
  updated_at: string
  /** Только у соревнований */
  discipline: string | null
  groups: string[]
}
export interface CalendarPage {
  items: CalendarItem[]
  total: number
}

/** Событие ФСП: карточка события и админка федерации */
export interface CalendarEvent {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  location: string | null
  is_online: boolean
  registration_url: string | null
  status: 'draft' | 'published' | 'archived'
  updated_at: string
}
export type EventInput = Pick<
  CalendarEvent,
  'title' | 'description' | 'starts_at' | 'ends_at' | 'location' | 'is_online' | 'registration_url'
>
export interface EventPage {
  items: CalendarEvent[]
  total: number
}

export const calendarApi = {
  list: (query: Query, signal?: AbortSignal) => request<CalendarPage>('/calendar/events', { query, signal }),
  detail: (id: string, signal?: AbortSignal) => request<CalendarEvent>(`/calendar/events/${id}`, { signal }),
  adminList: (query: Query) => request<EventPage>('/admin/calendar/events', { query }),
  create: (body: EventInput) => request<CalendarEvent>('/admin/calendar/events', { method: 'POST', body }),
  update: (id: string, body: EventInput) =>
    request<CalendarEvent>(`/admin/calendar/events/${id}`, { method: 'PATCH', body }),
  transition: (id: string, action: 'publish' | 'unpublish' | 'archive') =>
    request<CalendarEvent>(`/admin/calendar/events/${id}/${action}`, { method: 'POST' }),
}

export function useCalendarEvents(
  from: string,
  to: string,
  kind: string,
  q: string,
  filters: { discipline_id?: number; online?: boolean; mine?: boolean } = {},
) {
  return useQuery({
    queryKey: ['calendar', 'events', from, to, kind, q, filters],
    queryFn: async ({ signal }) => {
      const query = { ...filters, date_from: from, date_to: to, kind: kind || undefined, q, limit: 200 }
      const result = await calendarApi.list(query, signal)
      while (result.items.length < result.total) {
        const page = await calendarApi.list({ ...query, offset: result.items.length }, signal)
        if (!page.items.length) break
        result.items.push(...page.items)
      }
      return result
    },
    staleTime: 60_000,
  })
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: ['calendar', 'event', id],
    queryFn: ({ signal }) => calendarApi.detail(id, signal),
  })
}

export function useUpcomingEvents(limit = 5) {
  const today = todayOrenburg()
  return useQuery({
    queryKey: ['calendar', 'upcoming', today, limit],
    queryFn: ({ signal }) => calendarApi.list({ date_from: today, limit }, signal),
    staleTime: 60_000,
  })
}
