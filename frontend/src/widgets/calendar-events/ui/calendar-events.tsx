import { EventCard, useUpcomingEvents, type CalendarItem } from '@/entities/calendar'
import { CompetitionCard } from '@/entities/competition'
import { routes } from '@/shared/config'
import {
  Button,
  EmptyState,
  ErrorState,
  IconArrowRight,
  IconCalendar,
  SectionHeader,
  Skeleton,
} from '@/shared/ui'
import { contestCard } from '../lib/contest-card'

/** Элемент ленты: соревнование — карточкой соревнования, событие ФСП — листком календаря */
export function CalendarItemCard({
  item,
  highlight,
  className,
}: {
  item: CalendarItem
  highlight?: string
  className?: string
}) {
  return item.kind === 'contest' && item.contest_id != null ? (
    <CompetitionCard competition={contestCard(item)} highlight={highlight} className={className} />
  ) : (
    <EventCard
      event={item}
      to={item.kind === 'event' ? `${routes.calendar}/${item.id}` : undefined}
      highlight={highlight}
      className={className}
    />
  )
}

export function EventList({
  items,
  empty = 'На этот период ничего нет',
  highlightId = null,
}: {
  items: CalendarItem[]
  empty?: string
  /** Элемент с пометкой «Ближайшее» */
  highlightId?: string | null
}) {
  if (!items.length)
    return (
      <div className="card">
        <EmptyState
          title={empty}
          description="Выберите другой месяц или измените фильтры"
          icon={<IconCalendar size={26} />}
        />
      </div>
    )
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((event) => (
        <CalendarItemCard
          key={event.id}
          item={event}
          highlight={event.id === highlightId ? 'Ближайшее' : undefined}
        />
      ))}
    </div>
  )
}

/** «Ближайшее в календаре» на главной. skip — сколько первых уже показано выше (в hero) */
export function UpcomingEvents({ skip = 0 }: { skip?: number }) {
  const events = useUpcomingEvents()
  const items = events.data?.items.slice(skip) ?? []
  if (events.isSuccess && skip > 0 && !items.length) return null
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        title="Ближайшее в календаре"
        action={
          <Button to={routes.calendar} variant="secondary" rightIcon={<IconArrowRight size={18} />}>
            Весь календарь
          </Button>
        }
      />
      {events.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((id) => (
            <Skeleton key={id} className="h-60 rounded-lg" />
          ))}
        </div>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((event, index) => (
            <CalendarItemCard
              key={event.id}
              item={event}
              highlight={index === 0 && skip === 0 ? 'Ближайшее' : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="Ближайших событий пока нет"
            action={
              <Button to={routes.competitions} variant="secondary">
                Все соревнования
              </Button>
            }
          />
        </div>
      )}
    </section>
  )
}
