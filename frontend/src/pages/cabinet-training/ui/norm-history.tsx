import { formatNormValue, useNormHistory } from '@/entities/training'
import { formatDate } from '@/shared/lib'
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  StatusTag,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'

const day = (value: string) => formatDate(`${value}T12:00:00Z`)

/** История сдачи нормативов и аттестаций: в кабинете спортсмена и у тренера в карточке подопечного */
export function NormHistory({ athleteId }: { athleteId: string }) {
  const history = useNormHistory(athleteId)
  if (history.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />
  const { results, attestations } = history.data

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeader title="Аттестации" as="h3" />
        {attestations.length ? (
          <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
            {attestations.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5 px-4 py-2.5">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink">
                    {item.result_title}
                    {item.stage_to && ` «${item.stage_to.title}»`}
                  </span>
                  <span className="font-mono text-sm text-muted tabular-nums">{day(item.decided_on)}</span>
                </span>
                <span className="text-sm text-muted">
                  {[
                    item.group.name,
                    item.target_group && `→ ${item.target_group.name}`,
                    item.order_number && `приказ ${item.order_number}`,
                    item.is_override && 'решением федерации',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {item.comment && <span className="text-sm text-muted">{item.comment}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Аттестаций ещё не было</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeader title="Сдача нормативов" as="h3" />
        {results.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Дата</TH>
                <TH>Норматив</TH>
                <TH className="text-right">Результат</TH>
                <TH className="text-right">Порог</TH>
                <TH>Итог</TH>
              </TR>
            </THead>
            <TBody>
              {results.map((item) => (
                <TR key={item.id}>
                  <TD className="font-mono text-sm tabular-nums">{day(item.passed_on)}</TD>
                  <TD>
                    <span className="flex flex-col">
                      <span>{item.norm.name}</span>
                      <span className="text-xs text-muted">
                        {item.norm.kind === 'sfp' ? 'СФП' : 'ОФП'} · {item.norm.stage.title}
                      </span>
                    </span>
                  </TD>
                  <TD className="text-right font-mono tabular-nums">
                    {formatNormValue(item.value, item.norm.unit)}
                  </TD>
                  <TD className="text-right font-mono text-muted tabular-nums">
                    {item.norm.direction === 'higher' ? '≥' : '≤'}{' '}
                    {formatNormValue(item.threshold, item.norm.unit)}
                  </TD>
                  <TD>
                    <StatusTag tone={item.passed ? 'active' : 'cancelled'}>
                      {item.passed ? 'Выполнен' : 'Не выполнен'}
                    </StatusTag>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            title="Нормативы не сдавались"
            description="Результаты вносит тренер после приёма нормативов"
          />
        )}
      </section>
    </div>
  )
}
