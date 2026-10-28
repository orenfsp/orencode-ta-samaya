import { Link } from 'react-router'
import { useMyJudgeAssignments, type MyJudgeAssignment } from '@/entities/qualification'
import { CalendarAside } from '@/widgets/calendar-aside'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, StatusTag } from '@/shared/ui'

const FINISHED = new Set(['completed', 'archived', 'cancelled'])

function dates(contest: MyJudgeAssignment['contest']) {
  return contest.starts_on === contest.ends_on
    ? formatDate(contest.starts_on)
    : `${formatDate(contest.starts_on)} – ${formatDate(contest.ends_on)}`
}

function Group({ title, items }: { title: string; items: MyJudgeAssignment[] }) {
  if (!items.length) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3 font-medium">{title}</h2>
      <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                to={routes.competition(item.contest.id)}
                className="truncate text-ink hover:text-primary-text"
              >
                {item.contest.title}
              </Link>
              <span className="font-mono text-sm text-muted">{dates(item.contest)}</span>
            </div>
            <StatusTag tone={item.contest.status === 'cancelled' ? 'cancelled' : 'active'}>
              {item.contest.status === 'cancelled' ? 'Отменено' : item.position.name}
            </StatusTag>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Соревнования, в коллегию которых назначен судья, и его должность */
export function CabinetJudgeAssignmentsPage() {
  const data = useMyJudgeAssignments()
  const items = data.data ?? []
  const upcoming = items.filter((item) => !FINISHED.has(item.contest.status)).reverse()
  const past = items.filter((item) => FINISHED.has(item.contest.status))

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title="Мои назначения"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('judge') },
          { label: 'Мои назначения' },
        ]}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {data.isPending ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((id) => (
                <Skeleton key={id} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : data.isError ? (
            <ErrorState error={data.error} onRetry={() => data.refetch()} />
          ) : !items.length ? (
            <EmptyState
              title="Назначений пока нет"
              description="Коллегию назначает организатор соревнования или федерация. Нужна действующая категория"
              action={
                <Button variant="secondary" to={routes.cabinetQualification('judge')}>
                  Моя категория
                </Button>
              }
            />
          ) : (
            <>
              <Group title="Предстоящие" items={upcoming} />
              <Group title="Прошедшие" items={past} />
            </>
          )}
        </div>
        <CalendarAside
          title="Ближайшие назначения"
          marks={items
            .filter((item) => item.contest.status !== 'cancelled')
            .map((item) => ({
              id: item.contest.id,
              title: item.contest.title,
              start: item.contest.starts_on,
              end: item.contest.ends_on,
              to: routes.competition(item.contest.id),
            }))}
        />
      </div>
    </section>
  )
}
