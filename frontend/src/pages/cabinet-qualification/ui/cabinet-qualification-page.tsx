import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import {
  qualificationApi,
  qualificationKeys,
  useMyQualifications,
  ValidityTag,
  type Qualification,
  type QualificationKind,
} from '@/entities/qualification'
import { QualificationSubmitModal } from '@/features/qualification-submit'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  EmptyState,
  ErrorState,
  IconPlus,
  PageHeader,
  Skeleton,
  StatusTag,
  showToast,
  type StatusTone,
} from '@/shared/ui'

const TONES: Record<Qualification['status'], StatusTone> = {
  pending: 'draft',
  approved: 'active',
  rejected: 'cancelled',
  withdrawn: 'done',
  superseded: 'done',
}

const COPY = {
  judge: {
    kind: 'judge_category',
    title: 'Моя категория',
    lead: 'Назначить в коллегию можно, только если категория действует на дату соревнования',
    empty: 'Категория не присвоена',
  },
  athlete: {
    kind: 'rank',
    title: 'Мой разряд',
    lead: 'Разряд присваивает федерация по документу. Подать может спортсмен или тренер',
    empty: 'Разряд не присвоен',
  },
  coach: {
    kind: 'rank',
    title: 'Разряды спортсменов',
    lead: 'Заявки за спортсменов, которых вы записывали на соревнования',
    empty: 'Вы ещё не подавали заявок на разряд',
  },
} as const satisfies Record<string, { kind: QualificationKind; title: string; lead: string; empty: string }>

function HistoryRow({
  item,
  showPerson,
  withdrawing,
  onWithdraw,
}: {
  item: Qualification
  showPerson: boolean
  withdrawing: boolean
  onWithdraw: () => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ink">
          {showPerson ? `${item.user.name} · ${item.item_name}` : item.item_name}
        </span>
        <span className="text-sm text-muted">
          Подано {formatDate(item.created_at)}
          {item.decided_at ? ` · решение ${formatDate(item.decided_at)}` : ''}
        </span>
        {item.reject_reason && (
          <span className="text-sm text-live-text">Причина отказа: {item.reject_reason}</span>
        )}
      </div>
      {item.status === 'approved' ? (
        <ValidityTag validUntil={item.valid_until} />
      ) : (
        <StatusTag tone={TONES[item.status]}>{item.status_title}</StatusTag>
      )}
      {item.status === 'pending' && (
        <Button variant="text" size="sm" loading={withdrawing} onClick={onWithdraw}>
          Отозвать
        </Button>
      )}
    </li>
  )
}

/** Разряд спортсмена, категория судьи или заявки тренера за спортсменов: текущая ступень, срок, история */
export function CabinetQualificationPage() {
  const role = (useParams().role ?? 'athlete') as keyof typeof COPY
  const copy = COPY[role] ?? COPY.athlete
  const coach = role === 'coach'
  const data = useMyQualifications()
  const client = useQueryClient()
  const [form, setForm] = useState({ open: false, key: 0 })
  const withdraw = useMutation({
    mutationFn: qualificationApi.withdraw,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qualificationKeys.all })
      showToast('Заявка отозвана', { tone: 'success' })
    },
    onError: (error) => showToast('Не получилось отозвать', { tone: 'danger', description: error.message }),
  })

  const items =
    (coach ? data.data?.submitted : data.data?.items)?.filter((item) => item.kind === copy.kind) ?? []
  const current = coach ? null : (items.find((item) => item.status === 'approved') ?? null)
  const pending = coach ? null : (items.find((item) => item.status === 'pending') ?? null)
  const open = () => setForm((state) => ({ open: true, key: state.key + 1 }))
  const action = coach
    ? 'Подать за спортсмена'
    : current
      ? role === 'judge'
        ? 'Повысить категорию'
        : 'Повысить разряд'
      : 'Подать заявку'

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={copy.title}
        description={copy.lead}
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: copy.title },
        ]}
        actions={
          data.isSuccess && !pending ? (
            <Button leftIcon={<IconPlus size={18} />} onClick={open}>
              {action}
            </Button>
          ) : undefined
        }
      />

      {data.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => data.refetch()} />
      ) : (
        <>
          {!coach && (
            <section className="flex flex-col gap-3 card rounded-lg p-5 sm:p-6">
              <span className="text-sm text-muted">
                {role === 'judge' ? 'Действующая категория' : 'Действующий разряд'}
              </span>
              {current ? (
                <>
                  <span className="font-mono text-h3 font-medium">{current.item_name}</span>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                    <ValidityTag validUntil={current.valid_until} />
                    {current.valid_from && <span>Присвоено {formatDate(current.valid_from)}</span>}
                  </div>
                </>
              ) : (
                <span className="text-h4 text-ink">{copy.empty}</span>
              )}
              {pending && (
                <span className="text-sm text-muted">
                  На рассмотрении: «{pending.item_name}», подано {formatDate(pending.created_at)}
                </span>
              )}
            </section>
          )}

          {items.length ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-h3 font-medium">{coach ? 'Заявки' : 'История'}</h2>
              <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
                {items.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    showPerson={coach}
                    withdrawing={withdraw.isPending && withdraw.variables === item.id}
                    onWithdraw={() => withdraw.mutate(item.id)}
                  />
                ))}
              </ul>
            </section>
          ) : (
            coach && (
              <EmptyState
                title={copy.empty}
                description="Выберите спортсмена из своих заявок и приложите протокол или приказ"
                action={<Button onClick={open}>Подать за спортсмена</Button>}
              />
            )
          )}
        </>
      )}

      <QualificationSubmitModal
        key={form.key}
        open={form.open}
        kind={copy.kind}
        current={current}
        forAthlete={coach}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
