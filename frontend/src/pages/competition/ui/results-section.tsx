import { useState } from 'react'
import type { Competition } from '@/entities/competition'
import { resultApi, useContestResults, type ResultsScope } from '@/entities/result'
import { ResultsModal } from '@/features/results-manage'
import { formatNumber } from '@/shared/lib'
import {
  Button,
  ErrorState,
  IconDownload,
  IconPencil,
  PlaceMark,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'

const EDITABLE = new Set(['in_progress', 'completed'])

/** Места внизу карточки: всем — таблица, владельцу и федерации — ввод мест и протокол */
export function ResultsSection({ item, scope }: { item: Competition; scope: ResultsScope | null }) {
  const results = useContestResults(item.id)
  const [modal, setModal] = useState({ open: false, key: 0 })
  const editable = scope !== null && EDITABLE.has(item.status)
  const places = results.data?.items ?? []
  const team = item.participation_type === 'team'
  const withPoints = results.data?.is_verified ?? false

  if (!editable && (results.isPending || results.isError || !places.length)) return null

  return (
    <section className="flex flex-col gap-4" aria-busy={results.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-medium">Результаты</h2>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<IconPencil size={18} />}
              onClick={() => setModal((state) => ({ open: true, key: state.key + 1 }))}
            >
              {places.length ? 'Изменить места' : 'Внести места'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<IconDownload size={18} />}
              href={resultApi.protocolUrl(scope, item.id)}
            >
              Протокол, xlsx
            </Button>
          </div>
        )}
      </div>

      {results.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : !places.length ? (
        <p className="rounded-lg border border-line-soft px-5 py-6 text-sm text-muted">
          Места ещё не внесены
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-20">Место</TH>
              <TH>{team ? 'Команда' : 'Участник'}</TH>
              {withPoints && <TH className="text-right">Баллы</TH>}
            </TR>
          </THead>
          <TBody>
            {places.map((row) => (
              <TR key={row.athletes.map((athlete) => athlete.id).join()}>
                <TD>
                  {row.place != null ? (
                    <PlaceMark place={row.place} size="sm" />
                  ) : (
                    <span className="text-sm text-muted">Дискв.</span>
                  )}
                </TD>
                <TD>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink">{row.team_name ?? row.athletes[0]?.full_name}</span>
                    {row.team_name && (
                      <span className="text-sm text-muted">
                        {row.athletes.map((athlete) => athlete.full_name).join(', ')}
                      </span>
                    )}
                  </span>
                </TD>
                {withPoints && (
                  <TD className="text-right font-mono tabular-nums">{formatNumber(row.points)}</TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {scope && (
        <ResultsModal
          key={modal.key}
          scope={scope}
          contest={item}
          open={modal.open}
          onClose={() => setModal((state) => ({ ...state, open: false }))}
        />
      )}
    </section>
  )
}
