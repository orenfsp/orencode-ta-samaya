import { useParams } from 'react-router'
import { useMe } from '@/entities/session'
import { routes } from '@/shared/config'
import { Button, PageHeader, Skeleton } from '@/shared/ui'
import { AthleteRatings } from '@/widgets/athlete-ratings'
import { RatingReasons } from './rating-reasons'

/** Своё место во всех рейтингах: публичный рейтинг тот же, здесь — только про себя */
export function CabinetRatingPage() {
  const { role = 'athlete' } = useParams()
  const { data: me } = useMe()

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title="Мой рейтинг"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Мой рейтинг' },
        ]}
        actions={
          <Button variant="secondary" to={routes.ratings}>
            Весь рейтинг
          </Button>
        }
      />
      {me && <RatingReasons />}
      {me ? (
        <AthleteRatings
          userId={me.id}
          emptyAction={
            <Button variant="secondary" to={routes.cabinetCompetitions(role)}>
              Записаться на соревнование
            </Button>
          }
        />
      ) : (
        <Skeleton className="h-44 rounded-lg" />
      )}
    </section>
  )
}
