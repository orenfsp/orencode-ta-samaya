import { personAvatar } from '@/entities/person'
import { useState } from 'react'
import { useConsentQueue, type ConsentRow, type ConsentStatus } from '@/entities/consent'
import { formatDate, formatDateTime } from '@/shared/lib'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconSearch,
  Input,
  Pagination,
  ReasonModal,
  Select,
  StatusTag,
  Toolbar,
  type Column,
  PersonLine,
} from '@/shared/ui'
import { consentStatusTitles, consentTones } from '../model/labels'
import { useConsentActions, type ConsentActions } from '../model/use-consent-actions'

const PAGE = 30

const columns = (actions: ConsentActions, onReject: (row: ConsentRow) => void): Column<ConsentRow>[] => [
  {
    key: 'person',
    header: 'Спортсмен',
    primary: true,
    cell: (row) => (
      <PersonLine
        size="sm"
        name={row.person.full_name}
        avatar={personAvatar(row.person.id)}
        meta={`${formatDate(`${row.person.birth_date}T12:00:00Z`)} г. р. · ${row.person.email}`}
      />
    ),
  },
  {
    key: 'guardian',
    header: 'Представитель',
    cell: (row) => (
      <span className="flex flex-col">
        <span>{row.guardian_name}</span>
        <span className="font-mono text-xs text-muted">{row.guardian_phone}</span>
      </span>
    ),
  },
  {
    key: 'file',
    header: 'Скан',
    cell: (row) => (
      <a
        href={row.file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-underline text-sm text-ink focus-visible:field-focus"
      >
        Открыть
      </a>
    ),
  },
  {
    key: 'status',
    header: 'Статус',
    cell: (row) => (
      <span className="flex flex-col gap-0.5">
        <StatusTag tone={consentTones[row.status]}>{consentStatusTitles[row.status]}</StatusTag>
        {row.reject_reason && <span className="text-xs text-live-text">{row.reject_reason}</span>}
      </span>
    ),
  },
  {
    key: 'submitted',
    header: 'Отправлено',
    hideBelow: 'lg',
    width: 'w-40',
    cell: (row) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDateTime(row.submitted_at)}</span>
    ),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Действия</span>,
    actions: true,
    cell: (row) =>
      row.status === 'pending' ? (
        <span className="inline-flex gap-2">
          <Button
            size="sm"
            loading={actions.approve.isPending && actions.approve.variables === row.id}
            onClick={() => actions.approve.mutate(row.id)}
          >
            Одобрить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onReject(row)}>
            Отклонить
          </Button>
        </span>
      ) : null,
  },
]

/** Согласия законных представителей: таблица, сначала на проверке, решение в строке */
export function ConsentReview() {
  const [status, setStatus] = useState<ConsentStatus | ''>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<{ open: boolean; row: ConsentRow | null }>({
    open: false,
    row: null,
  })
  const actions = useConsentActions()
  const queue = useConsentQueue(
    { status: status || undefined, search: search.trim() || undefined },
    PAGE,
    (page - 1) * PAGE,
  )
  const items = queue.data?.items ?? []
  const total = queue.data?.total ?? 0

  return (
    <div className="flex flex-col gap-6">
      <Toolbar
        search={
          <Field label="Поиск по спортсмену или представителю">
            <Input
              type="search"
              maxLength={200}
              leftIcon={<IconSearch size={18} />}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </Field>
        }
      >
        <Field label="Статус">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ConsentStatus | '')
              setPage(1)
            }}
            options={[
              { value: '', label: 'Любой' },
              ...(Object.entries(consentStatusTitles) as [ConsentStatus, string][]).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </Field>
      </Toolbar>

      {queue.isError && !queue.data ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Согласия представителей"
            columns={columns(actions, (row) => {
              actions.reject.reset()
              setRejecting({ open: true, row })
            })}
            rows={items}
            rowKey={(row) => row.id}
            loading={queue.isPending}
            empty={
              <EmptyState title={status === 'pending' ? 'Все согласия проверены' : 'Согласий не найдено'} />
            }
          />
          <div className="flex flex-col items-center gap-2">
            <Pagination page={page} totalPages={Math.ceil(total / PAGE)} onPage={setPage} />
          </div>
        </>
      )}

      <ReasonModal
        open={rejecting.open}
        title="Отклонить согласие?"
        description={
          rejecting.row
            ? `${rejecting.row.person.full_name}. Человек увидит причину и загрузит новый скан`
            : undefined
        }
        label="Причина отказа"
        confirmLabel="Отклонить"
        pending={actions.reject.isPending}
        error={actions.reject.error}
        onClose={() => setRejecting((state) => ({ ...state, open: false }))}
        onSubmit={(reason) =>
          rejecting.row &&
          actions.reject.mutate(
            { id: rejecting.row.id, reason },
            { onSuccess: () => setRejecting((state) => ({ ...state, open: false })) },
          )
        }
      />
    </div>
  )
}
