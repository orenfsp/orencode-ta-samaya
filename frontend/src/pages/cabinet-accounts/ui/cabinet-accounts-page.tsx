import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  moderatedRoles,
  RoleRequestRow,
  roleTabTitles,
  statusTitles,
  useRoleModeration,
  useRoleRequestCounts,
  useRoleRequests,
  type ModeratedRole,
  type RoleRequestFilters,
} from '@/features/account-moderate'
import { useMe, type RoleStatus } from '@/entities/session'
import { routes } from '@/shared/config'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconSearch,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
} from '@/shared/ui'

const STEP = 30

type Tab = 'all' | ModeratedRole

const statusOptions = [
  { value: '', label: 'Любой' },
  ...(Object.entries(statusTitles) as [RoleStatus, string][]).map(([value, label]) => ({ value, label })),
]

const isTab = (value: string | null): value is Tab =>
  value === 'all' || moderatedRoles.includes(value as ModeratedRole)
const isStatus = (value: string | null): value is RoleStatus =>
  value === 'pending' || value === 'verified' || value === 'rejected'

/** Модерация аккаунтов федерацией: тренеры, судьи, организации и сотрудники ФСП */
export function CabinetAccountsPage() {
  const { data: me } = useMe()
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(STEP)

  const roleParam = params.get('role')
  const tab: Tab = isTab(roleParam) ? roleParam : 'all'
  const statusParam = params.get('status')
  const status = isStatus(statusParam) ? statusParam : undefined
  const search = params.get('q') ?? ''

  // Фильтры живут в адресе: ссылкой на «судьи на проверке» можно поделиться
  const update = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value && value !== 'all') next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
    setLimit(STEP)
  }

  const filters: RoleRequestFilters = {
    role: tab === 'all' ? undefined : tab,
    status,
    search: search.trim() || undefined,
  }
  const requests = useRoleRequests(filters, limit, Boolean(me))
  const counts = useRoleRequestCounts()
  const actions = useRoleModeration()

  const pending = counts.data?.pending
  const pendingTotal = pending ? moderatedRoles.reduce((sum, role) => sum + pending[role], 0) : 0
  const tabLabel = (title: string, count: number) => (
    <span className="flex items-center gap-2">
      {title}
      {count > 0 && (
        <span className="font-mono text-sm text-live-text tabular-nums" aria-label={`на проверке: ${count}`}>
          {count}
        </span>
      )}
    </span>
  )

  const items = requests.data?.items ?? []
  const total = requests.data?.total ?? 0
  const filtered = Boolean(filters.status || filters.search)
  const reset = () => {
    setParams(tab === 'all' ? {} : { role: tab }, { replace: true })
    setLimit(STEP)
  }

  if (!me) return null

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Модерация аккаунтов' },
        ]}
        title="Модерация аккаунтов"
        description="Подтверждение ролей. Судья, организация и сотрудник ФСП работают в кабинете только после подтверждения"
      />

      <Tabs
        aria-label="Роль"
        variant="underline"
        value={tab}
        onChange={(next) => update('role', next)}
        items={[
          { value: 'all', label: tabLabel('Все', pendingTotal) },
          ...moderatedRoles.map((role) => ({
            value: role,
            label: tabLabel(roleTabTitles[role], pending?.[role] ?? 0),
          })),
        ]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-end sm:gap-4">
        <Field label="Поиск по ФИО или email">
          <Input
            type="search"
            maxLength={200}
            leftIcon={<IconSearch size={18} />}
            value={search}
            onChange={(event) => update('q', event.target.value)}
          />
        </Field>
        <Field label="Статус">
          <Select
            value={status ?? ''}
            options={statusOptions}
            onChange={(event) => update('status', event.target.value)}
          />
        </Field>
      </div>

      {requests.isPending ? (
        <Card padding="none">
          <ul className="divide-y divide-line-soft">
            {[1, 2, 3, 4].map((id) => (
              <li key={id} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-40 max-w-full" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : requests.isError ? (
        <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
      ) : !items.length ? (
        <Card>
          <EmptyState
            title={filtered ? 'Никого не нашли' : 'Аккаунтов нет'}
            description={
              filtered
                ? 'Измените поиск или статус'
                : 'Здесь появятся люди, которые выбрали эту роль при регистрации'
            }
            action={
              filtered ? (
                <Button variant="secondary" onClick={reset}>
                  Сбросить фильтры
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6" aria-busy={requests.isFetching}>
          <Card padding="none">
            <ul className="divide-y divide-line-soft">
              {items.map((item) => (
                <RoleRequestRow
                  key={item.id}
                  item={item}
                  currentUserId={me.id}
                  showRole={tab === 'all'}
                  actions={actions}
                />
              ))}
            </ul>
          </Card>
          {items.length < total && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                variant="secondary"
                loading={requests.isFetching}
                onClick={() => setLimit((current) => current + STEP)}
              >
                Показать ещё
              </Button>
              <span className="font-mono text-sm text-muted">
                {items.length} из {total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
