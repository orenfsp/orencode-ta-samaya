import { useUpcomingEvents } from '@/entities/calendar'
import { useDictionaryOptions } from '@/entities/dictionary'
import { DisciplineCard } from '@/entities/discipline'
import { routes } from '@/shared/config'
import { Button, ErrorState, SectionHeader, Skeleton } from '@/shared/ui'
import { CalendarItemCard, UpcomingEvents } from '@/widgets/calendar-events'
import { RecentNews } from '@/widgets/recent-news'

/** Ближайшее событие рядом с заголовком: первое, что ищут на сайте федерации */
function NextUp() {
  const events = useUpcomingEvents()
  const next = events.data?.items[0]
  if (events.isPending) return <Skeleton className="h-64 rounded-lg" />
  if (!next) return null
  return <CalendarItemCard item={next} highlight="Ближайшее" />
}

function Disciplines() {
  const disciplines = useDictionaryOptions('disciplines')
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader title="Дисциплины" />
      {disciplines.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4].map((id) => (
            <Skeleton key={id} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : disciplines.isError ? (
        <ErrorState error={disciplines.error} onRetry={() => disciplines.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {disciplines.data.map((discipline, index) => (
            <DisciplineCard
              key={discipline.id}
              name={discipline.name}
              description={discipline.description}
              to={`${routes.competitions}?discipline_id=${discipline.id}`}
              className="animate-rise"
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function HomePage() {
  return (
    <div className="container-page flex flex-col gap-16 pt-10 pb-4 sm:gap-24 sm:pt-16">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-6">
          <h1 className="text-display font-medium text-balance">
            Спортивное программирование в&nbsp;Оренбургской области
          </h1>
          <p className="max-w-2xl text-lead text-muted">
            Календарь соревнований, заявки, разряды и рейтинг спортсменов региона.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button to={routes.competitions} size="lg">
              Соревнования
            </Button>
            <Button to={routes.ratings} size="lg" variant="secondary">
              Рейтинг
            </Button>
          </div>
        </div>
        <NextUp />
      </section>

      <UpcomingEvents skip={1} />
      <RecentNews />
      <Disciplines />
    </div>
  )
}
