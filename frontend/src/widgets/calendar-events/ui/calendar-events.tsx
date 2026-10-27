import { EventCard, eventDates, useUpcomingEvents, type CalendarItem } from '@/entities/calendar'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconArrowRight,
  IconCalendar,
  IconMapPin,
  KindTag,
  MetaTag,
  Skeleton,
  StatusTag,
  VerifiedMark,
} from '@/shared/ui'

/** Соревнование в ленте календаря: полоса-сетка сверху, как у карточки соревнования в каталоге */
function CompetitionItem({ item, highlight }: { item: CalendarItem; highlight?: string }) {
  return (
    <Card
      to={routes.competition(item.contest_id!)}
      padding="none"
      className="flex h-full flex-col overflow-hidden"
    >
      <div className="grid-texture flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
        <KindTag kind="contest" />
        {highlight && <StatusTag tone="live">{highlight}</StatusTag>}
      </div>
      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          {item.status !== 'published' && (
            <StatusTag tone={item.status === 'in_progress' ? 'live' : 'active'}>
              {item.status_title}
            </StatusTag>
          )}
          <h3 className="flex items-start gap-2 text-h3 font-medium text-balance break-words">
            <span className="min-w-0 flex-1">{item.title}</span>
            {item.is_verified && <VerifiedMark className="mt-0.5" />}
          </h3>
        </div>
        <div className="mt-auto flex flex-col gap-2 text-sm text-muted">
          <span className="flex items-start gap-2">
            <IconCalendar size={16} className="mt-px shrink-0" />
            {eventDates(item)}
          </span>
          {item.location && (
            <span className="flex items-start gap-2">
              <IconMapPin size={16} className="mt-px shrink-0" />
              {item.location}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MetaTag accent={item.is_online}>{item.is_online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
        </div>
      </div>
    </Card>
  )
}

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
    <div className={cn('h-full', className)}>
      <CompetitionItem item={item} highlight={highlight} />
    </div>
  ) : (
    <EventCard
      event={item}
      to={`${routes.calendar}/${item.id}`}
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

export function UpcomingEvents() {
  const events = useUpcomingEvents()
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 font-medium">Ближайшее в календаре</h2>
        </div>
        <Button to={routes.calendar} variant="paper" rightIcon={<IconArrowRight size={18} />}>
          Весь календарь
        </Button>
      </div>
      {events.isPending ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.data.items.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {events.data.items.map((event, index) => (
            <CalendarItemCard key={event.id} item={event} highlight={index === 0 ? 'Ближайшее' : undefined} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="Ближайших событий пока нет"
            description="Новые соревнования и анонсы появятся здесь после публикации"
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
