import { personAvatar } from '@/entities/person'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuditCatalog, useAuditLog, type AuditEntry } from '@/entities/audit'
import { routes } from '@/shared/config'
import { formatOrenburgDateTime } from '@/shared/lib'
import {
  Button,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  IconSearch,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Toolbar,
  type Column,
  PersonLine,
} from '@/shared/ui'
import { AuditDetails } from './audit-details'
import { readAuditFilters, type AuditFilterKey } from './filters'

const PAGE = 50

const options = (all: string, list: { code: string; label: string }[], current: string) => [
  { value: '', label: all },
  ...list.map((item) => ({ value: item.code, label: item.label })),
  ...(current && !list.some((item) => item.code === current) ? [{ value: current, label: current }] : []),
]

const columns: Column<AuditEntry>[] = [
  {
    key: 'time',
    header: 'Время',
    sortable: true,
    width: 'w-44',
    cell: (entry) => (
      <time dateTime={entry.created_at} className="font-mono text-sm text-muted tabular-nums">
        {formatOrenburgDateTime(entry.created_at)}
      </time>
    ),
  },
  {
    key: 'action',
    header: 'Действие',
    primary: true,
    cell: (entry) => <span className="[overflow-wrap:anywhere]">{entry.action_label}</span>,
  },
  {
    key: 'user',
    header: 'Автор',
    cell: (entry) =>
      entry.user ? (
        <PersonLine
          size="sm"
          name={entry.user.full_name}
          avatar={personAvatar(entry.user.id)}
          meta={entry.user.email}
        />
      ) : (
        <span className="text-muted">Без автора</span>
      ),
  },
  {
    key: 'object',
    header: 'Объект',
    hideBelow: 'lg',
    cell: (entry) => <span className="text-muted">{entry.object_label ?? '—'}</span>,
  },
  {
    key: 'ip',
    header: 'IP',
    hideBelow: 'xl',
    width: 'w-36',
    cell: (entry) => <span className="font-mono text-xs text-muted">{entry.ip ?? '—'}</span>,
  },
]

/** Журнал действий федерации таблицей: фильтры строкой сверху, порядок по времени, детали записи — в окне */
export function AuditPage() {
  const [params, setParams] = useSearchParams()
  const [opened, setOpened] = useState<AuditEntry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const values = readAuditFilters(params)
  const order = params.get('order') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const invalid = Boolean(values.date_from && values.date_to && values.date_from > values.date_to)
  const catalog = useAuditCatalog()
  const list = useAuditLog(values, { limit: PAGE, offset: (page - 1) * PAGE, order }, !invalid)
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const filtered = Object.values(values).some(Boolean)

  const change = (key: AuditFilterKey | 'order' | 'page', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }
  const reset = () => setParams(order === 'asc' ? { order } : {})

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Журнал действий"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Журнал действий' },
        ]}
        actions={
          <Button
            variant="secondary"
            loading={list.isFetching && !list.isPending}
            onClick={() => list.refetch()}
          >
            Обновить
          </Button>
        }
      />

      <Toolbar
        search={
          <Field label="Автор">
            <Input
              type="search"
              leftIcon={<IconSearch size={18} />}
              placeholder="ФИО или email"
              value={values.q}
              onChange={(event) => change('q', event.target.value)}
            />
          </Field>
        }
        end={
          filtered && (
            <Button variant="ghost" onClick={reset}>
              Сбросить
            </Button>
          )
        }
      >
        <Field label="Действие">
          <Select
            value={values.action}
            onChange={(event) => change('action', event.target.value)}
            options={options('Все действия', catalog.data?.actions ?? [], values.action)}
          />
        </Field>
        <Field label="Объект">
          <Select
            value={values.object_type}
            onChange={(event) => change('object_type', event.target.value)}
            options={options('Все объекты', catalog.data?.objects ?? [], values.object_type)}
          />
        </Field>
        <Field label="С">
          <DateInput value={values.date_from} onChange={(value) => change('date_from', value)} />
        </Field>
        <Field label="По">
          <DateInput value={values.date_to} onChange={(value) => change('date_to', value)} />
        </Field>
      </Toolbar>

      {values.user_id && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">Действия одного пользователя</span>
          <Button variant="text" size="sm" onClick={() => change('user_id', '')}>
            Показать всех
          </Button>
        </div>
      )}

      {invalid ? (
        <FormAlert>Дата окончания раньше даты начала</FormAlert>
      ) : list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Журнал действий"
            columns={columns}
            rows={items}
            rowKey={(entry) => entry.id}
            loading={list.isPending}
            sort={{ key: 'time', dir: order }}
            onSort={(_, dir) => change('order', dir === 'asc' ? 'asc' : '')}
            onRowClick={(entry) => {
              setOpened(entry)
              setDetailsOpen(true)
            }}
            empty={
              <EmptyState
                title="Записей не найдено"
                description="Измените период или сбросьте фильтры"
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={reset}>
                      Сбросить фильтры
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          {total > 0 && (
            <div className="flex flex-col items-center gap-2">
              <Pagination
                page={page}
                totalPages={Math.ceil(total / PAGE)}
                onPage={(next) => change('page', next > 1 ? String(next) : '')}
              />
              <span className="font-mono text-sm text-muted tabular-nums">
                {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} из {total}
              </span>
            </div>
          )}
        </>
      )}

      <Modal
        size="lg"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={opened?.action_label ?? 'Запись журнала'}
        description={opened ? formatOrenburgDateTime(opened.created_at) : undefined}
      >
        {opened && (
          <AuditDetails
            entry={opened}
            onUser={(id) => {
              setDetailsOpen(false)
              change('user_id', id)
            }}
          />
        )}
      </Modal>
    </section>
  )
}
