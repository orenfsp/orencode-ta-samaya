import { useState } from 'react'
import { Link } from 'react-router'
import {
  calendarDays,
  dayLabel,
  eventDates,
  monthBounds,
  monthLabel,
  moveMonth,
  todayOrenburg,
  useCalendarEvents,
} from '@/entities/calendar'
import { useMe } from '@/entities/session'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import {
  Button,
  IconArrowRight,
  IconButton,
  IconChevronLeft,
  IconChevronRight,
  Skeleton,
  Tabs,
  ErrorState,
} from '@/shared/ui'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export interface CalendarMark {
  id: string | number
  title: string
  start: string
  end: string
  to: string
}

/**
 * Календарь сбоку раздела: месяц с точками ленты ФСП, свои соревнования — синей заливкой дня,
 * под сеткой — ближайшие свои. День ведёт в общий календарь на эту дату.
 */
export function CalendarAside({
  marks = [],
  title = 'Мои ближайшие',
  markLabel = 'Мои',
  className,
}: {
  marks?: CalendarMark[]
  title?: string
  /** Подпись выделенных дней в легенде */
  markLabel?: string
  className?: string
}) {
  const { data: me } = useMe()
  const [minePreference, setMine] = useState(() => {
    try {
      return localStorage.getItem('fsp.calendar.mine') === 'true'
    } catch {
      return false
    }
  })
  const mineOnly = Boolean(me && minePreference)
  const today = todayOrenburg()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [from, to] = monthBounds(month)
  const feed = useCalendarEvents(from, to, '', '', { mine: mineOnly || undefined })
  const days = calendarDays(month)
  const items = feed.data?.items ?? []
  const upcoming = marks
    .filter((mark) => mark.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4)

  return (
    <aside className={cn('flex flex-col gap-5', className)} aria-label="Календарь">
      <section className="flex flex-col gap-3 card p-4">
        {me && (
          <Tabs
            aria-label="Соревнования календаря"
            fullWidth
            value={mineOnly ? 'mine' : 'all'}
            items={[
              { value: 'all', label: 'Все' },
              { value: 'mine', label: 'Только мои' },
            ]}
            onChange={(value) => {
              setMine(value === 'mine')
              try {
                localStorage.setItem('fsp.calendar.mine', String(value === 'mine'))
              } catch {
                /* Хранилище может быть недоступно. */
              }
            }}
          />
        )}
        {feed.isError && <ErrorState error={feed.error} onRetry={() => feed.refetch()} />}
        <div className="flex items-center justify-between gap-2">
          <IconButton
            aria-label="Предыдущий месяц"
            size="sm"
            icon={<IconChevronLeft size={18} />}
            onClick={() => setMonth(moveMonth(month, -1))}
          />
          <span className="font-mono text-sm first-letter:uppercase">
            {monthLabel(month).replace(' г.', '')}
          </span>
          <IconButton
            aria-label="Следующий месяц"
            size="sm"
            icon={<IconChevronRight size={18} />}
            onClick={() => setMonth(moveMonth(month, 1))}
          />
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {weekdays.map((label, index) => (
            <span
              key={label}
              className={cn('pb-1 font-mono text-xs', index >= 5 ? 'text-muted' : 'text-ink')}
            >
              {label}
            </span>
          ))}
          {feed.isPending
            ? days.map((date) => <Skeleton key={date} className="mx-auto size-8 rounded-full" />)
            : days.map((date) => {
                const inMonth = date.startsWith(month)
                const mine = marks.some((mark) => mark.start <= date && mark.end >= date)
                const dayItems = items.filter(
                  (item) => item.start_date <= date && (item.end_date ?? item.start_date) >= date,
                )
                return (
                  <Link
                    key={date}
                    to={`${routes.calendar}?month=${month}&day=${date}${mineOnly ? '&mine=true' : ''}`}
                    aria-label={`${dayLabel(date)}${mine ? ', ваше соревнование' : ''}${dayItems.length ? `, в календаре: ${dayItems.length}` : ''}`}
                    tabIndex={inMonth ? 0 : -1}
                    className={cn(
                      'mx-auto flex size-8 flex-col items-center justify-center rounded-full font-mono text-xs transition-colors outline-none focus-visible:field-focus',
                      !inMonth && 'pointer-events-none opacity-30',
                      mine ? 'bg-primary text-white' : 'hover:bg-surface-3',
                      date === today && !mine && 'text-live-text ring-2 ring-live ring-inset',
                    )}
                  >
                    {Number(date.slice(-2))}
                    <span className="flex h-1 gap-0.5" aria-hidden="true">
                      {!mine &&
                        dayItems
                          .slice(0, 3)
                          .map((item) => (
                            <span
                              key={item.id}
                              className={cn(
                                'size-1 rounded-full',
                                item.kind === 'contest' ? 'bg-primary' : 'bg-live',
                              )}
                            />
                          ))}
                    </span>
                  </Link>
                )
              })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft pt-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" /> {markLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> Соревнование
          </span>
          {!mineOnly && (
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-live" aria-hidden="true" /> Событие ФСП
            </span>
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-muted">{title}</h2>
          <ul className="flex flex-col gap-2">
            {upcoming.map((mark) => (
              <li key={mark.id}>
                <Link
                  to={mark.to}
                  className="flex flex-col gap-1 rounded-md border-l-2 border-primary bg-surface-2 py-2 pr-3 pl-3 transition-colors outline-none hover:bg-surface-3 focus-visible:field-focus light:bg-surface"
                >
                  <span className="line-clamp-2 text-sm text-ink">{mark.title}</span>
                  <span className="text-xs text-muted">
                    {eventDates({ start_date: mark.start, end_date: mark.end })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button to={routes.calendar} variant="secondary" size="sm" rightIcon={<IconArrowRight size={16} />}>
        Весь календарь
      </Button>
    </aside>
  )
}
