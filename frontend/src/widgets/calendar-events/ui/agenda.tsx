import { Link } from 'react-router'
import { dayLabel, eventDates, type CalendarItem } from '@/entities/calendar'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import { MetaTag, StatusTag, VerifiedMark } from '@/shared/ui'

const linkFor = (item: CalendarItem) =>
  item.kind === 'contest' && item.contest_id != null
    ? routes.competition(item.contest_id)
    : `${routes.calendar}/${item.id}`

/** Строка ленты, как строка события на fsp-russia.ru: полоса цвета вида, название, когда, формат и место */
function AgendaRow({ item, highlight }: { item: CalendarItem; highlight?: boolean }) {
  const contest = item.kind === 'contest'
  return (
    <li>
      <Link
        to={linkFor(item)}
        className="group grid grid-cols-[0.25rem_minmax(0,1fr)] gap-x-4 px-4 py-3.5 transition-colors hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:outline-none sm:px-5"
      >
        <span aria-hidden="true" className={cn('rounded-full', contest ? 'bg-primary' : 'bg-live')} />
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-muted">{contest ? 'Соревнование' : 'Событие ФСП'}</span>
            {highlight && <StatusTag tone="live">Ближайшее</StatusTag>}
            {item.status === 'in_progress' && <StatusTag tone="live">{item.status_title}</StatusTag>}
          </span>
          <span className="flex items-start gap-2 text-body font-medium text-ink group-hover:text-primary-text">
            <span className="min-w-0">{item.title}</span>
            {item.is_verified && <VerifiedMark className="mt-0.5 [&_svg]:size-4" />}
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span>{eventDates(item)}</span>
            {item.discipline && <span>{item.discipline}</span>}
            {item.location && <span className="min-w-0 truncate">{item.location}</span>}
            <MetaTag accent={item.is_online}>{item.is_online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Лента календаря по дням: заголовок дня и строки под ним. Многодневное — в день начала,
 * а начавшееся раньше месяца — в первый день месяца. id дня — для прокрутки с сетки месяца.
 */
export function Agenda({
  items,
  from,
  highlightId,
  selectedDay,
}: {
  items: CalendarItem[]
  /** Первый день показанного периода */
  from: string
  selectedDay?: string
  highlightId?: string | null
}) {
  const groups = new Map<string, CalendarItem[]>()
  for (const item of [...items].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    const day = item.start_date < from ? from : item.start_date
    groups.set(day, [...(groups.get(day) ?? []), item])
  }
  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([day, dayItems]) => (
        <section
          key={day}
          id={`day-${day}`}
          className={cn('scroll-mt-28', selectedDay === day && 'rounded-lg bg-primary-soft p-3')}
        >
          <h3 className="mb-2 font-mono text-sm text-ink first-letter:uppercase">{dayLabel(day)}</h3>
          <ul className="divide-y divide-line-soft overflow-hidden card">
            {dayItems.map((item) => (
              <AgendaRow key={item.id} item={item} highlight={item.id === highlightId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
