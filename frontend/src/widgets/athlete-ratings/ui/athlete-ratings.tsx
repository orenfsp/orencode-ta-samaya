import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { groupKindTitles, RATING_WINDOW, useAthleteRatings, type RatingStanding } from '@/entities/rating'
import { routes } from '@/shared/config'
import { formatDate, formatNumber, plural } from '@/shared/lib'
import {
  Accordion,
  IconArrowRight,
  EmptyState,
  ErrorState,
  PlaceMark,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'

function Scores({ standing }: { standing: RatingStanding }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Соревнование</TH>
          <TH className="hidden sm:table-cell">Дата</TH>
          <TH className="w-20">Место</TH>
          <TH className="text-right">Баллы</TH>
        </TR>
      </THead>
      <TBody>
        {standing.scores.map((score) => (
          <TR key={score.contest.id}>
            <TD>
              <Link to={routes.competition(score.contest.id)} className="text-ink hover:text-primary-text">
                {score.contest.title}
              </Link>
            </TD>
            <TD className="hidden font-mono text-sm text-muted tabular-nums sm:table-cell">
              {formatDate(score.contest.ends_on)}
            </TD>
            <TD>
              {score.place != null ? (
                <PlaceMark place={score.place} size="sm" />
              ) : (
                <span className="text-sm text-muted">Дискв.</span>
              )}
            </TD>
            <TD className="text-right font-mono tabular-nums">{formatNumber(score.points)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

/**
 * Положение спортсмена во всех рейтингах, где он есть: место в своей возрастной и академической группе
 * по каждой дисциплине и из каких мест сложились баллы. Тот же блок пойдёт в публичный профиль.
 */
export function AthleteRatings({ userId, emptyAction }: { userId: string; emptyAction?: ReactNode }) {
  const ratings = useAthleteRatings(userId)
  const items = ratings.data ?? []

  if (ratings.isPending)
    return (
      <div className="flex flex-col gap-4">
        {[1, 2].map((id) => (
          <Skeleton key={id} className="h-44 rounded-lg" />
        ))}
      </div>
    )
  if (ratings.isError) return <ErrorState error={ratings.error} onRetry={() => ratings.refetch()} />
  if (!items.length)
    return (
      <div className="card">
        <EmptyState
          title="Пока нет в рейтинге"
          description={`В рейтинг идут места в верифицированных соревнованиях ${RATING_WINDOW}`}
          action={emptyAction}
        />
      </div>
    )

  const disciplines = items.reduce<RatingStanding[][]>((result, item) => {
    const last = result[result.length - 1]
    if (last && last[0]!.discipline.id === item.discipline.id) last.push(item)
    else result.push([item])
    return result
  }, [])

  return (
    <div className="flex flex-col gap-10">
      {disciplines.map((standings) => {
        const first = standings[0]!
        return (
          <section key={first.discipline.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-h3 font-medium">{first.discipline.name}</h2>
              <span className="font-mono text-sm text-muted tabular-nums">
                {formatNumber(first.points)} {plural(first.points, ['балл', 'балла', 'баллов'])}
              </span>
            </div>
            <ul className="divide-y divide-line-soft overflow-hidden card">
              {standings.map((standing) => (
                <li key={standing.group_kind}>
                  <Link
                    to={`${routes.ratingTable}?${new URLSearchParams({
                      discipline_id: String(standing.discipline.id),
                      group_id: String(standing.group.id),
                      ...(standing.group_kind === 'academic' ? { kind: 'academic' } : {}),
                    })}`}
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-hover-tint sm:grid-cols-[auto_minmax(0,1fr)_7rem_7rem_auto] sm:px-5"
                  >
                    <PlaceMark place={standing.place} size="lg" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-lead text-ink">{standing.group.name}</span>
                      <span className="truncate text-sm text-muted">
                        {groupKindTitles[standing.group_kind]} · из {standing.total}{' '}
                        {plural(standing.total, ['спортсмена', 'спортсменов', 'спортсменов'])}
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block font-mono text-h3 text-ink tabular-nums">
                        {formatNumber(standing.points)}
                      </span>
                      <span className="text-xs text-muted">баллов</span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block font-mono text-h3 text-ink tabular-nums">
                        {standing.contests}
                      </span>
                      <span className="text-xs text-muted">
                        {plural(standing.contests, ['старт', 'старта', 'стартов'])}
                      </span>
                    </span>
                    <IconArrowRight
                      size={18}
                      className="text-muted transition-[translate,color] duration-220 group-hover:translate-x-1 group-hover:text-ink"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <Accordion
              items={[
                {
                  id: 'scores',
                  title: `Из чего сложились баллы · ${first.contests} ${plural(first.contests, ['старт', 'старта', 'стартов'])}`,
                  content: <Scores standing={first} />,
                },
              ]}
            />
          </section>
        )
      })}
    </div>
  )
}
