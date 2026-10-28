import { Link } from 'react-router'
import { usePersonalPath, type EvskRule } from '@/entities/evsk'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import { Button, ErrorState, SectionHeader, Skeleton } from '@/shared/ui'

const day = (value: string) => formatDate(`${value}T12:00:00Z`)

function ruleLine(rule: EvskRule) {
  const parts = [
    `${rule.place_to === 1 ? '1 место' : `места 1–${rule.place_to}`}`,
    rule.contest_level.name.toLowerCase(),
    rule.discipline?.name,
    rule.min_participants ? `от ${rule.min_participants} участников` : null,
    rule.max_age ? `до ${rule.max_age} лет` : rule.min_age ? `с ${rule.min_age} лет` : null,
  ]
  return parts.filter(Boolean).join(', ')
}

/**
 * Личный путь спортсмена: что уже даёт право подать на разряд, что нужно для следующего и где это взять.
 * Нормы — из правил ЕВСК федерации; демо-нормы подписаны.
 */
export function PersonalPath({
  onApply,
}: {
  onApply: (initial: { itemId: number; resultId: number }) => void
}) {
  const path = usePersonalPath()
  if (path.isPending) return <Skeleton className="h-40 rounded-lg" />
  if (path.isError) return <ErrorState error={path.error} onRetry={() => path.refetch()} />
  const data = path.data
  const demo = data.next?.rules.some((rule) => rule.is_demo)

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Личный путь" />
      {data.achieved.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/50 bg-primary-soft p-4">
          <h3 className="font-medium">Можно подать заявку</h3>
          <ul className="flex flex-col gap-2">
            {data.achieved.map((item) => (
              <li
                key={`${item.result_id}-${item.rank_type_id}`}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="text-ink">
                  «{item.rank}» — {item.place} место, {item.contest_title}
                </span>
                <Button
                  size="sm"
                  onClick={() => onApply({ itemId: item.rank_type_id, resultId: item.result_id })}
                >
                  Подать
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.next ? (
        <div className="flex flex-col gap-3 card rounded-lg p-5">
          <span className="text-sm text-muted">Следующая ступень</span>
          <span className="text-h4 font-mono font-medium">{data.next.rank.name}</span>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-ink">
            {data.next.rules.map((rule) => (
              <li key={rule.id}>{ruleLine(rule)}</li>
            ))}
          </ul>
          {demo && (
            <p className="text-sm text-muted">
              Нормы демонстрационные: федерация заменит их официальными нормами ЕВСК
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted">Для следующих ступеней федерация ещё не внесла нормы ЕВСК</p>
      )}
      {data.contests.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">Подходящие соревнования</h3>
          <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
            {data.contests.map((contest) => (
              <li key={contest.id}>
                <Link
                  to={routes.competition(contest.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 field-focus px-4 py-3 transition-colors hover:bg-hover-tint"
                >
                  <span className="w-24 shrink-0 font-mono text-sm text-muted tabular-nums">
                    {day(contest.starts_on)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">{contest.title}</span>
                  <span className="text-sm text-muted">
                    {contest.level}, заявки до {day(contest.registration_closes_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.later.length > 0 && (
        <p className="text-sm text-muted">Дальше: {data.later.map((item) => item.name).join(' → ')}</p>
      )}
      <p className="text-sm text-muted">
        Что значат разряды и звания —{' '}
        <Link to={routes.glossary} className="link-underline text-ink">
          справочник понятий
        </Link>
      </p>
    </section>
  )
}
