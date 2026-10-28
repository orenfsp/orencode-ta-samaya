import { personAvatar } from '@/entities/person'
import { useSearchParams } from 'react-router'
import {
  moderatedRoles,
  RoleRequestActions,
  roleTabTitles,
  roleTitles,
  statusTitles,
  statusTones,
  useRoleModeration,
  useRoleRequestCounts,
  useRoleRequests,
  type ModeratedRole,
  type RoleRequest,
  type RoleRequestFilters,
} from '@/features/account-moderate'
import { useConsentCount } from '@/entities/consent'
import { fullName, useMe, type RoleStatus } from '@/entities/session'
import { ConsentReview } from '@/features/guardian-consent'
import { routes } from '@/shared/config'
import { formatDate, formatDateTime } from '@/shared/lib'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconSearch,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusTag,
  Tabs,
  Toolbar,
  type Column,
  PersonLine,
} from '@/shared/ui'

const PAGE = 30

type Tab = 'all' | 'consents' | ModeratedRole

const statusOptions = [
  { value: '', label: 'Любой' },
  ...(Object.entries(statusTitles) as [RoleStatus, string][]).map(([value, label]) => ({ value, label })),
]

const isTab = (value: string | null): value is Tab =>
  value === 'all' || value === 'consents' || moderatedRoles.includes(value as ModeratedRole)
const isStatus = (value: string | null): value is RoleStatus =>
  value === 'pending' || value === 'verified' || value === 'rejected'

const columns = (
  showRole: boolean,
  currentUserId: string,
  actions: ReturnType<typeof useRoleModeration>,
): Column<RoleRequest>[] => [
  {
    key: 'name',
    header: 'ФИО',
    primary: true,
    cell: (item) => (
      <PersonLine
        size="sm"
        name={fullName(item.user)}
        avatar={personAvatar(item.user.id)}
        meta={item.user.email}
      />
    ),
  },
  ...(showRole
    ? [{ key: 'role', header: 'Роль', cell: (item: RoleRequest) => roleTitles[item.role as ModeratedRole] }]
    : []),
  {
    key: 'status',
    header: 'Статус',
    cell: (item) => (
      <span className="flex flex-col gap-0.5">
        <StatusTag tone={statusTones[item.status]}>{statusTitles[item.status]}</StatusTag>
        {item.status === 'rejected' && item.reject_reason && (
          <span className="text-xs text-live-text">{item.reject_reason}</span>
        )}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Подана',
    hideBelow: 'lg',
    width: 'w-32',
    cell: (item) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDate(item.created_at)}</span>
    ),
  },
  {
    key: 'decided',
    header: 'Решение',
    hideBelow: 'xl',
    cell: (item) =>
      item.decided_at ? (
        <span className="flex flex-col text-sm">
          <span className="font-mono text-muted tabular-nums">{formatDateTime(item.decided_at)}</span>
          {item.decided_by && (
            <span className="text-muted">
              {item.decided_by.last_name} {item.decided_by.first_name}
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'actions',
    header: <span className="sr-only">Действия</span>,
    actions: true,
    cell: (item) => <RoleRequestActions item={item} currentUserId={currentUserId} actions={actions} />,
  },
]

/** Модерация аккаунтов федерацией: тренеры, судьи, организации и сотрудники ФСП */
export function CabinetAccountsPage() {
  const { data: me } = useMe()
  const [params, setParams] = useSearchParams()

  const roleParam = params.get('role')
  const tab: Tab = isTab(roleParam) ? roleParam : 'all'
  const statusParam = params.get('status')
  const status = isStatus(statusParam) ? statusParam : undefined
  const search = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  // Фильтры живут в адресе: ссылкой на «судьи на проверке» можно поделиться
  const update = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value && value !== 'all') next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  const consentCount = useConsentCount()
  const filters: RoleRequestFilters = {
    role: tab === 'all' || tab === 'consents' ? undefined : tab,
    status,
    search: search.trim() || undefined,
  }
  const requests = useRoleRequests(filters, PAGE, (page - 1) * PAGE, Boolean(me) && tab !== 'consents')
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
          { value: 'consents', label: tabLabel('Согласия', consentCount.data?.pending ?? 0) },
        ]}
      />

      {tab === 'consents' ? (
        <ConsentReview />
      ) : (
        <>
          <Toolbar
            search={
              <Field label="Поиск по ФИО или email">
                <Input
                  type="search"
                  maxLength={200}
                  leftIcon={<IconSearch size={18} />}
                  value={search}
                  onChange={(event) => update('q', event.target.value)}
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
            <Field label="Статус">
              <Select
                value={status ?? ''}
                options={statusOptions}
                onChange={(event) => update('status', event.target.value)}
              />
            </Field>
          </Toolbar>

          {requests.isError && !requests.data ? (
            <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
          ) : (
            <>
              <DataTable
                caption="Роли на модерации"
                columns={columns(tab === 'all', me.id, actions)}
                rows={items}
                rowKey={(item) => item.id}
                loading={requests.isPending}
                empty={
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
                }
              />
              {total > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <Pagination
                    page={page}
                    totalPages={Math.ceil(total / PAGE)}
                    onPage={(next) => update('page', next > 1 ? String(next) : '')}
                  />
                  <span className="font-mono text-sm text-muted tabular-nums">
                    {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} из {total}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
