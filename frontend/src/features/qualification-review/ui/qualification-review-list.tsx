import { personAvatar } from '@/entities/person'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import {
  qualificationApi,
  qualificationKeys,
  ValidityTag,
  type Qualification,
} from '@/entities/qualification'
import { formatDate } from '@/shared/lib'
import {
  Button,
  DataTable,
  IconFile,
  ReasonModal,
  StatusTag,
  showToast,
  type Column,
  type StatusTone,
  PersonLine,
} from '@/shared/ui'
import { ApproveModal } from './approve-modal'

const TONES: Record<Qualification['status'], StatusTone> = {
  pending: 'draft',
  approved: 'active',
  rejected: 'cancelled',
  withdrawn: 'done',
  superseded: 'done',
}

const columns = (
  onApprove: (item: Qualification) => void,
  onReject: (item: Qualification) => void,
): Column<Qualification>[] => [
  {
    key: 'person',
    header: 'Кому',
    primary: true,
    cell: (item) => (
      <PersonLine
        size="sm"
        name={item.user.name}
        avatar={personAvatar(item.user.id)}
        meta={item.submitted_by.id !== item.user.id ? `подал тренер ${item.submitted_by.name}` : undefined}
      />
    ),
  },
  {
    key: 'item',
    header: 'Что',
    cell: (item) => (
      <span className="flex min-w-0 flex-col">
        <span>{item.item_name}</span>
        {item.basis_result && (
          <span className="text-xs text-muted">
            {item.basis_result.place} место · {item.basis_result.contest_title}
          </span>
        )}
        {item.basis && <span className="text-xs text-muted">Основание: {item.basis}</span>}
        {item.order_number && (
          <span className="text-xs text-muted">
            Приказ {item.order_number}
            {item.order_date && ` от ${formatDate(item.order_date)}`}
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Подано',
    hideBelow: 'lg',
    width: 'w-32',
    cell: (item) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDate(item.created_at)}</span>
    ),
  },
  {
    key: 'status',
    header: 'Статус',
    cell: (item) => (
      <span className="flex flex-col gap-0.5">
        {item.status === 'approved' ? (
          <ValidityTag validUntil={item.valid_until} />
        ) : (
          <StatusTag tone={TONES[item.status]}>{item.status_title}</StatusTag>
        )}
        {item.reject_reason && <span className="text-xs text-live-text">{item.reject_reason}</span>}
      </span>
    ),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Действия</span>,
    actions: true,
    cell: (item) => (
      <span className="inline-flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<IconFile size={16} />}
          href={qualificationApi.documentUrl(item.document_file_id)}
          external
        >
          Документ
        </Button>
        {item.status === 'pending' && (
          <>
            <Button variant="secondary" size="sm" onClick={() => onReject(item)}>
              Отказать
            </Button>
            <Button size="sm" onClick={() => onApprove(item)}>
              Присвоить
            </Button>
          </>
        )}
      </span>
    ),
  },
]

/** Очередь федерации: присвоить с расчётом срока или отказать с причиной */
export function QualificationReviewList({
  items,
  loading,
  empty,
}: {
  items: Qualification[]
  loading?: boolean
  empty?: ReactNode
}) {
  const client = useQueryClient()
  const [approving, setApproving] = useState<{ open: boolean; item: Qualification | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })
  const [rejecting, setRejecting] = useState<{ open: boolean; item: Qualification | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })
  const refresh = () => client.invalidateQueries({ queryKey: qualificationKeys.all })
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => qualificationApi.reject(id, reason),
    onSuccess: () => {
      void refresh()
      showToast('Отказ отправлен', { tone: 'success' })
      setRejecting((current) => ({ ...current, open: false }))
    },
  })

  return (
    <>
      <DataTable
        caption="Разряды и категории"
        columns={columns(
          (item) => setApproving((current) => ({ open: true, item, key: current.key + 1 })),
          (item) => {
            reject.reset()
            setRejecting((current) => ({ open: true, item, key: current.key + 1 }))
          },
        )}
        rows={items}
        rowKey={(item) => item.id}
        loading={loading}
        empty={empty}
      />
      <ApproveModal
        key={approving.key}
        open={approving.open}
        item={approving.item}
        onClose={() => setApproving((current) => ({ ...current, open: false }))}
        onDone={() => {
          void refresh()
          showToast('Присвоено', { tone: 'success' })
          setApproving((current) => ({ ...current, open: false }))
        }}
      />
      <ReasonModal
        key={rejecting.key}
        open={rejecting.open}
        title="Отказать"
        description={
          rejecting.item ? `${rejecting.item.user.name}: «${rejecting.item.item_name}»` : undefined
        }
        confirmLabel="Отказать"
        pending={reject.isPending}
        error={reject.error}
        onClose={() => setRejecting((current) => ({ ...current, open: false }))}
        onSubmit={(reason) => rejecting.item && reject.mutate({ id: rejecting.item.id, reason })}
      />
    </>
  )
}
