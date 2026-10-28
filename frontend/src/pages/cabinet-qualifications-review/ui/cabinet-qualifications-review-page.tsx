import { useSearchParams } from 'react-router'
import {
  useQualificationQueue,
  type QualificationKind,
  type QualificationStatus,
} from '@/entities/qualification'
import { QualificationReviewList } from '@/features/qualification-review'
import { routes } from '@/shared/config'
import { EmptyState, ErrorState, Field, PageHeader, Select, Tabs, Toolbar } from '@/shared/ui'

type Status = QualificationStatus | 'all'

const STATUSES: { value: Status; label: string }[] = [
  { value: 'pending', label: 'На рассмотрении' },
  { value: 'approved', label: 'Присвоено' },
  { value: 'rejected', label: 'Отказано' },
  { value: 'all', label: 'Все' },
]

/** Очереди федерации: судейские категории и разряды спортсменов */
export function CabinetQualificationsReviewPage() {
  const [params, setParams] = useSearchParams()
  const kind: QualificationKind = params.get('kind') === 'rank' ? 'rank' : 'judge_category'
  const status = (STATUSES.find((item) => item.value === params.get('status'))?.value ?? 'pending') as Status
  const set = (next: { kind?: QualificationKind; status?: Status }) =>
    setParams({ kind: next.kind ?? kind, status: next.status ?? status }, { replace: true })
  const queue = useQualificationQueue(kind, status)
  const items = queue.data ?? []

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Разряды и категории"
        description="Присвоение по документу. Срок считается от дня решения по справочнику"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Разряды и категории' },
        ]}
      />
      <Tabs
        aria-label="Вид"
        variant="underline"
        value={kind}
        onChange={(value) => set({ kind: value })}
        items={[
          { value: 'judge_category', label: 'Судейские категории' },
          { value: 'rank', label: 'Разряды' },
        ]}
      />
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
          items={items}
          loading={queue.isPending}
          empty={
            <EmptyState
              title={status === 'pending' ? 'Очередь пуста' : 'Ничего не найдено'}
              description={status === 'pending' ? undefined : 'Выберите другой статус'}
            />
          }
        />
      )}
    </section>
  )
}
