import { formatOrenburgDateTime, formatOrenburgTime, orenburgDay, orenburgDayLabel } from '@/shared/lib'
import type { NotificationItem } from '@/shared/ui'
import type { Notification } from '../model/types'

/** Ссылка из уведомления — только внутренний путь сайта */
export const safeNotificationLink = (value: string | null) =>
  value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : undefined

/** Уведомление API → строка ленты. В группах по дням показываем только время */
export const toNotificationItem = (item: Notification, timeOnly = false): NotificationItem => ({
  id: item.id,
  title: item.title,
  text: item.text,
  time: timeOnly ? formatOrenburgTime(item.created_at) : formatOrenburgDateTime(item.created_at),
  unread: !item.is_read,
  to: safeNotificationLink(item.link),
})

/** Лента по дням Оренбурга: «Сегодня», «Вчера», «14 октября» */
export function groupByDay(items: Notification[]) {
  const groups: { day: string; label: string; items: Notification[] }[] = []
  for (const item of items) {
    const day = orenburgDay(item.created_at)
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(item)
    else groups.push({ day, label: orenburgDayLabel(day), items: [item] })
  }
  return groups
}
