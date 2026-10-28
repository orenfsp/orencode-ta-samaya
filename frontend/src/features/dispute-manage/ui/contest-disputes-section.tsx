import { useState } from 'react'
import { useContestDisputes } from '@/entities/dispute'
import { useMe } from '@/entities/session'
import { formatDate, orenburgDay } from '@/shared/lib'
import { Button } from '@/shared/ui'
import { AppealModal } from './appeal-modal'
import { AppealsTable, ViolationsTable } from './dispute-tables'
import { ViolationModal } from './violation-modal'

/**
 * Апелляции и нарушения на странице идущего или завершённого соревнования.
 * Участник подаёт апелляцию на своё место, судья коллегии — рапорт; организатор, судьи и федерация видят всё.
 */
export function ContestDisputesSection({ contestId, held }: { contestId: number; held: boolean }) {
  const { data: me } = useMe()
  const disputes = useContestDisputes(contestId, Boolean(me) && held)
  const [appeal, setAppeal] = useState({ open: false, key: 0 })
  const [report, setReport] = useState({ open: false, key: 0 })
  if (!me || !held || !disputes.data) return null
  const data = disputes.data
  const federation = me.available_roles.includes('federation')
  const canAppeal = data.entries.length > 0 && orenburgDay(new Date()) <= data.appeal_until
  const hasItems = data.appeals.length > 0 || data.violations.length > 0
  if (!canAppeal && !data.can_report && !hasItems) return null

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3 font-medium">Апелляции и нарушения</h2>
          {canAppeal && (
            <p className="text-sm text-muted">
              Апелляции на места принимаются до {formatDate(data.appeal_until)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {data.can_report && (
            <Button
              variant="secondary"
              onClick={() => setReport((state) => ({ open: true, key: state.key + 1 }))}
            >
              Рапорт о нарушении
            </Button>
          )}
          {canAppeal && (
            <Button onClick={() => setAppeal((state) => ({ open: true, key: state.key + 1 }))}>
              Подать апелляцию
            </Button>
          )}
        </div>
      </div>
      {(data.privileged || data.appeals.length > 0) && (
        <AppealsTable items={data.appeals} federation={federation} meId={me.id} empty="Апелляций нет" />
      )}
      {(data.privileged || data.violations.length > 0) && (
        <ViolationsTable items={data.violations} federation={federation} empty="Рапортов о нарушениях нет" />
      )}
      <AppealModal
        key={`appeal-${appeal.key}`}
        open={appeal.open}
        contestId={contestId}
        entries={data.entries}
        onClose={() => setAppeal((state) => ({ ...state, open: false }))}
      />
      <ViolationModal
        key={`report-${report.key}`}
        open={report.open}
        contestId={contestId}
        participants={data.participants}
        onClose={() => setReport((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
