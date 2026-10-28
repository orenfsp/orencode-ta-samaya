import { useSearchParams } from 'react-router'
import { useEvskCandidates } from '@/entities/evsk'
import {
  useQualificationQueue,
  type QualificationKind,
  type QualificationStatus,
} from '@/entities/qualification'
import { EvskCandidates, EvskRulesPanel } from '@/features/evsk-rules'
import { QualificationReviewList } from '@/features/qualification-review'
import { routes } from '@/shared/config'
import { EmptyState, ErrorState, Field, PageHeader, Select, Tabs, Toolbar } from '@/shared/ui'

type Status = QualificationStatus | 'all'
type Tab = QualificationKind | 'evsk' | 'rules'

const STATUSES: { value: Status; label: string }[] = [
  { value: 'pending', label: 'На рассмотрении' },
  { value: 'approved', label: 'Присвоено' },
  { value: 'rejected', label: 'Отказано' },
  { value: 'all', label: 'Все' },
]

const TABS: { value: Tab; label: string }[] = [
  { value: 'judge_category', label: 'Судейские категории' },
  { value: 'rank', label: 'Разряды' },
  { value: 'evsk', label: 'Кандидаты по ЕВСК' },
  { value: 'rules', label: 'Правила ЕВСК' },
]

/** Очереди федерации: категории и разряды, кандидаты по протоколам и нормы ЕВСК */
export function CabinetQualificationsReviewPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((item) => item.value === params.get('kind'))?.value ?? 'judge_category') as Tab
  const status = (STATUSES.find((item) => item.value === params.get('status'))?.value ?? 'pending') as Status
  const set = (next: { kind?: Tab; status?: Status }) =>
    setParams({ kind: next.kind ?? tab, status: next.status ?? status }, { replace: true })
  const queueKind: QualificationKind = tab === 'judge_category' ? 'judge_category' : 'rank'
  const queue = useQualificationQueue(queueKind, status)
  const candidates = useEvskCandidates(tab === 'evsk')

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Разряды и категории"
        description="Присвоение по документу и приказу. Срок считается от дня решения по справочнику"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Разряды и категории' },
        ]}
      />
      <Tabs
        aria-label="Раздел"
        variant="underline"
        value={tab}
        onChange={(value) => set({ kind: value })}
        items={TABS}
      />

      {tab === 'rules' ? (
        <EvskRulesPanel />
      ) : tab === 'evsk' ? (
        candidates.isError ? (
          <ErrorState error={candidates.error} onRetry={() => candidates.refetch()} />
        ) : (
          <EvskCandidates items={candidates.data ?? []} loading={candidates.isPending} />
        )
      ) : (
        <>
          <Toolbar>
            <Field label="Статус">
              <Select
                value={status}
                onChange={(event) => set({ status: event.target.value as Status })}
                options={STATUSES}
              />
            </Field>
          </Toolbar>
          {queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
          ) : (
            <QualificationReviewList
              items={queue.data ?? []}
              loading={queue.isPending}
              empty={
                <EmptyState
                  title={status === 'pending' ? 'Очередь пуста' : 'Ничего не найдено'}
                  description={status === 'pending' ? undefined : 'Выберите другой статус'}
                />
              }
            />
          )}
        </>
      )}
    </section>
  )
}
