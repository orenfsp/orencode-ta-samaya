import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useAdminOrganizations, type Organization } from '@/entities/organization'
import { OrganizationFormModal } from '@/features/organization-manage'
import { OrganizationCardModal } from '@/features/training-manage'
import { routes } from '@/shared/config'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconPlus,
  IconSearch,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusTag,
  Toolbar,
  type Column,
} from '@/shared/ui'

const PAGE = 20

const columns: Column<Organization>[] = [
  {
    key: 'name',
    header: 'Организация',
    primary: true,
    cell: (item) => (
      <span className="flex min-w-0 flex-col">
        <span className="[overflow-wrap:anywhere]">{item.short_name ?? item.name}</span>
        {item.short_name && <span className="truncate text-xs text-muted">{item.name}</span>}
      </span>
    ),
  },
  { key: 'type', header: 'Тип', cell: (item) => item.organization_type.name },
  {
    key: 'municipality',
    header: 'Муниципалитет',
    hideBelow: 'lg',
    cell: (item) => item.municipality?.name ?? '—',
  },
  {
    key: 'athletes',
    header: 'Спортсменов',
    align: 'right',
    cell: (item) => <span className="font-mono tabular-nums">{item.athletes}</span>,
  },
  {
    key: 'status',
    header: 'Статус',
    hideBelow: 'xl',
    cell: (item) => (
      <StatusTag tone={item.is_active ? 'active' : 'done'}>
        {item.is_active ? 'Действует' : 'В архиве'}
      </StatusTag>
    ),
  },
]

/** Организации спортивной подготовки: школы, вузы, спортшколы, клубы. Из них — реестр и численность */
export function CabinetOrganizationsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = params.get('type') ?? ''
  const municipality = params.get('municipality') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const types = useDictionaryOptions('organization_types')
  const municipalities = useDictionaryOptions('municipalities')
  const list = useAdminOrganizations({
    q: q || undefined,
    organization_type_id: type ? Number(type) : undefined,
    municipality_id: municipality ? Number(municipality) : undefined,
    limit: PAGE,
    offset: (page - 1) * PAGE,
  })
  const [form, setForm] = useState<{ open: boolean; item: Organization | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })
  const [card, setCard] = useState<{ open: boolean; item: Organization | null }>({ open: false, item: null })
  const total = list.data?.total ?? 0
  const filtered = Boolean(q || type || municipality)

  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }
  const open = (item: Organization | null) => setForm((state) => ({ open: true, item, key: state.key + 1 }))

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Организации"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Организации' },
        ]}
        actions={
          <Button leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
            Добавить
          </Button>
        }
      />
      <Toolbar
        search={
          <Field label="Поиск">
            <Input
              type="search"
              leftIcon={<IconSearch size={18} />}
              placeholder="Название или ИНН"
              value={q}
              onChange={(event) => change('q', event.target.value)}
            />
          </Field>
        }
        end={
          filtered && (
            <Button variant="ghost" onClick={() => setParams({})}>
              Сбросить
            </Button>
          )
        }
      >
        <Field label="Тип">
          <Select
            value={type}
            onChange={(event) => change('type', event.target.value)}
            options={[
              { value: '', label: 'Все типы' },
              ...(types.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
        <Field label="Муниципалитет">
          <Select
            value={municipality}
            onChange={(event) => change('municipality', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...(municipalities.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
      </Toolbar>
      {list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Организации"
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={(item) => item.id}
            loading={list.isPending}
            onRowClick={(item) => setCard({ open: true, item })}
            empty={
              <EmptyState
                title={filtered ? 'Ничего не нашли' : 'Организаций пока нет'}
                description={filtered ? 'Измените поиск или фильтры' : 'Добавьте школы, вузы и клубы региона'}
                action={<Button onClick={() => open(null)}>Добавить организацию</Button>}
              />
            }
          />
          {total > PAGE && (
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
      <OrganizationCardModal
        open={card.open}
        organizationId={card.item?.id ?? null}
        onEdit={() => {
          setCard((state) => ({ ...state, open: false }))
          open(card.item)
        }}
        onClose={() => setCard((state) => ({ ...state, open: false }))}
      />
      <OrganizationFormModal
        key={form.key}
        open={form.open}
        item={form.item}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
