import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { Card, IconCalendar, IconMapPin, KindTag, MetaTag, StatusTag, type StatusTone } from '@/shared/ui'
import { datePlate, eventDates } from '../lib/dates'

type CardEvent = {
  title: string
  start_date?: string
  end_date?: string | null
  starts_at?: string | null
  ends_at?: string | null
  location: string | null
  is_online: boolean
}

/**
 * Карточка события ФСП. Акцент событий — красный (у соревнований — синий).
 * Отличается от соревнования с первого взгляда:
 * у соревнования сверху дисциплина на сетке, у события — листок календаря с днём и временем.
 * Ссылка (to) — у карточки целиком; в кабинете вместо ссылки встают действия (footer).
 */
export function EventCard({
  event,
  to,
  status,
  highlight,
  footer,
  className,
}: {
  event: CardEvent
  to?: string
  /** Статус в кабинете; на сайте показываем только опубликованные — без статуса */
  status?: { tone: StatusTone; title: string }
  /** Красная метка «важного»: «Ближайшее», «Сегодня» */
  highlight?: string
  footer?: ReactNode
  className?: string
}) {
  const plate = datePlate(event)
  return (
    <Card to={footer ? undefined : to} className={cn('flex h-full flex-col gap-5', className)}>
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-md border border-line-soft"
        >
          <span className="w-full bg-live py-0.5 text-center font-mono text-xs text-white">
            {plate.month}
          </span>
          <span className="pt-1 font-mono text-h2 leading-none">{plate.day}</span>
          <span className="pb-1.5 font-mono text-xs text-muted">{plate.time ?? plate.weekday}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <KindTag kind="event" />
            {highlight && <StatusTag tone="live">{highlight}</StatusTag>}
            {status && <StatusTag tone={status.tone}>{status.title}</StatusTag>}
          </div>
          <h3 className="text-h3 font-medium text-balance break-words">{event.title}</h3>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 text-sm text-muted">
        <span className="flex items-start gap-2">
          <IconCalendar size={16} className="mt-px shrink-0" />
          {eventDates(event)}
        </span>
        {event.location && (
          <span className="flex items-start gap-2">
            <IconMapPin size={16} className="mt-px shrink-0" />
            {event.location}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaTag accent={event.is_online}>{event.is_online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
      </div>
      {footer}
    </Card>
  )
}
