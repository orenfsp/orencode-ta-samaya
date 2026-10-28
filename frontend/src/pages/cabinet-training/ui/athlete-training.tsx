import { useMe } from '@/entities/session'
import { useAthleteAttendance, useAthleteEnrollments } from '@/entities/training'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  EmptyState,
  ErrorState,
  Facts,
  MetaTag,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatusTag,
  TextLink,
} from '@/shared/ui'
import { NormHistory } from './norm-history'

const day = (value: string) => formatDate(`${value}T12:00:00Z`)

/** Раздел спортсмена: текущая группа и этап, посещаемость, история групп, нормативы и аттестации */
export function AthleteTraining() {
  const me = useMe()
  const id = me.data?.id ?? null
  const enrollments = useAthleteEnrollments(id)
  const attendance = useAthleteAttendance(id)
  const current = (enrollments.data ?? []).filter((item) => !item.valid_to)
  const past = (enrollments.data ?? []).filter((item) => item.valid_to)

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title="Подготовка"
        description="Группа, занятия, нормативы и аттестации по федеральному стандарту"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('athlete') },
          { label: 'Подготовка' },
        ]}
      />
      {enrollments.isPending ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : enrollments.isError ? (
        <ErrorState error={enrollments.error} onRetry={() => enrollments.refetch()} />
      ) : !current.length ? (
        <EmptyState
          title="Вы не зачислены в группу"
          description="Зачисляет тренер организации, где вы занимаетесь"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {current.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 card rounded-lg p-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg">{item.group.name}</h2>
                <span className="text-sm text-muted">{item.group.organization.name}</span>
              </div>
              <Facts
                layout="stack"
                className="grid-cols-2"
                items={[
                  { label: 'Этап', value: item.group.stage.title },
                  { label: 'Дисциплина', value: item.group.discipline.name },
                  { label: 'Тренер', value: item.group.coach.name },
                  { label: 'В группе с', value: day(item.valid_from) },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Занятия за 90 дней"
          action={
            attendance.data && (
              <span className="font-mono text-sm text-muted tabular-nums">
                посещено {attendance.data.attended} из {attendance.data.total}
              </span>
            )
          }
        />
        {attendance.isPending ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : attendance.isError ? (
          <ErrorState error={attendance.error} onRetry={() => attendance.refetch()} />
        ) : !attendance.data.sessions.length ? (
          <p className="text-sm text-muted">Занятий за этот период нет</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
            {attendance.data.sessions.slice(0, 12).map((session) => {
              const mark = session.marks.find((item) => item.athlete.id === id)
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink">{session.topic}</span>
                    <span className="font-mono text-sm text-muted tabular-nums">{day(session.held_on)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <MetaTag accent={session.format === 'online'}>{session.format_title}</MetaTag>
                    {session.proof_url && <TextLink href={session.proof_url}>Запись</TextLink>}
                    <StatusTag tone={mark?.present ? 'active' : 'draft'}>
                      {mark?.present ? 'Был' : 'Не был'}
                    </StatusTag>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {id && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Нормативы и аттестации" />
          <NormHistory athleteId={id} />
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="История групп" />
          <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
            {past.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink">{item.group.name}</span>
                  <span className="text-sm text-muted">
                    {item.group.stage.title} · {item.end_reason_title}
                  </span>
                </span>
                <span className="font-mono text-sm text-muted tabular-nums">
                  {day(item.valid_from)} – {item.valid_to && day(item.valid_to)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
