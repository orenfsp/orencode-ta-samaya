import { DisciplineCard, disciplines } from '@/entities/discipline'
import { routes } from '@/shared/config'
import { Button } from '@/shared/ui'
import { UpcomingEvents } from '@/widgets/calendar-events'
import { RecentNews } from '@/widgets/recent-news'

export function HomePage() {
  return (
    <div className="container-page flex flex-col gap-16 pt-10 sm:gap-24 sm:pt-16">
      <section className="flex flex-col gap-6">
        <h1 className="max-w-4xl text-h1 font-medium text-balance">
          Спортивное программирование в&nbsp;Оренбургской области
        </h1>
        <p className="max-w-2xl text-lead text-muted">
          Календарь соревнований, заявки, разряды и рейтинг спортсменов региона.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button to={routes.competitions} size="lg">
            Соревнования
          </Button>
        </div>
      </section>

      <RecentNews />
      <UpcomingEvents />

      <section className="flex flex-col gap-6">
        <h2 className="text-h2 font-medium">Дисциплины</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {disciplines.map((discipline, index) => (
            <DisciplineCard
              key={discipline.id}
              discipline={discipline}
              className="animate-rise"
              style={{ animationDelay: `${index * 60}ms` }}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
