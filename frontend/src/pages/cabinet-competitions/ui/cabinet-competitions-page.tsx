import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import {
  canEdit,
  CompetitionCard,
  statusTitles,
  useManagedCompetitions,
  verificationMark,
  verificationTitles,
  type CompetitionFilters,
  type CompetitionScope,
  type CompetitionSort,
  type ManagedCompetition,
} from '@/entities/competition'
import { useContestsWithApplications } from '@/entities/application'
import { fullName, useMe, type Role } from '@/entities/session'
import { useRoleRequests } from '@/features/account-moderate'
import { ModerationModal } from '@/features/application-moderate'
import { JudgePanelModal } from '@/features/judge-panel'
import { ReadinessModal } from '@/features/readiness-check'
import {
  CompetitionActionsMenu,
  PublishCompetitionButton,
  CompetitionFormModal,
  useCompetitionActions,
} from '@/features/competition-manage'
import { CalendarAside } from '@/widgets/calendar-aside'
import { routes } from '@/shared/config'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconPlus,
  IconSearch,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  VerifiedMark,
} from '@/shared/ui'

const STEP = 20

type Tab = 'all' | 'queue'

/** Отдельного списка пользователей нет: организаторы — подтверждённые роли organizer */
function useOrganizerOptions(enabled: boolean) {
  const organizers = useRoleRequests({ role: 'organizer', status: 'verified' }, 200, 0, enabled)
  return {
    data: organizers.data?.items.map(({ user }) => ({
      value: user.id,
      label: fullName(user),
      description: user.email,
    })),
  }
}

const statusOptions = [
  { value: '', label: 'Все статусы' },
  ...Object.entries(statusTitles).map(([value, label]) => ({ value, label })),
]
const sortOptions: { value: CompetitionSort; label: string }[] = [
  { value: 'date_desc', label: 'Сначала свежие' },
  { value: 'date_asc', label: 'Сначала ранние' },
  { value: 'created_desc', label: 'Недавно добавленные' },
  { value: 'title', label: 'По названию' },
]
const verificationOptions = [
  { value: '', label: 'Любая' },
  ...Object.entries(verificationTitles).map(([value, label]) => ({ value, label })),
]

function CompetitionTile({
  item,
  scope,
  actions,
  waiting,
  onEdit,
  onApplications,
  onJudges,
  onReadiness,
}: {
  item: ManagedCompetition
  scope: CompetitionScope
  actions: ReturnType<typeof useCompetitionActions>
  /** Заявок на рассмотрении; null — заявок нет вовсе */
  waiting: number | null
  onEdit: () => void
  onApplications: () => void
  onJudges: () => void
  onReadiness: () => void
}) {
  const mark = verificationMark[item.verification_status]
  return (
    <CompetitionCard
      competition={item}
      verification={
        mark ? <VerifiedMark state={mark} reason={item.verification_reason} className="mt-0.5" /> : null
      }
      extra={
        (scope === 'admin' ||
          (item.verification_status === 'rejected' && item.verification_reason) ||
          (item.status === 'cancelled' && item.cancel_reason)) && (
          <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4 text-sm">
            {scope === 'admin' && <span className="text-muted">Организатор: {item.organizer.full_name}</span>}
            {item.verification_status === 'rejected' && item.verification_reason && (
              <span className="text-live-text">Отказ в верификации: {item.verification_reason}</span>
            )}
            {item.status === 'cancelled' && item.cancel_reason && (
              <span className="text-muted">Причина отмены: {item.cancel_reason}</span>
            )}
          </div>
        )
      }
      footer={
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <PublishCompetitionButton item={item} actions={actions} />
          {canEdit(item.status) && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Изменить
            </Button>
          )}
          {(waiting != null || item.status !== 'draft') && (
            <Button variant="secondary" size="sm" onClick={onApplications}>
              Заявки
              {waiting ? <span className="font-mono text-live-text tabular-nums">{waiting}</span> : null}
            </Button>
          )}
          {!['draft', 'completed', 'archived', 'cancelled'].includes(item.status) && (
            <Button variant="secondary" size="sm" onClick={onJudges}>
              Судьи
            </Button>
          )}
          {item.status !== 'cancelled' && (
            <Button variant="secondary" size="sm" onClick={onReadiness}>
              Готовность
            </Button>
          )}
          <Button variant="text" size="sm" to={routes.competition(item.id)} className="mr-auto">
            Открыть
          </Button>
          <CompetitionActionsMenu item={item} scope={scope} actions={actions} onEdit={onEdit} />
        </div>
      }
    />
  )
}

/** «Соревнования» в кабинете: организатор ведёт свои, федерация — все и очередь верификации */
export function CabinetCompetitionsPage() {
  const role = useParams().role as Role
  const scope: CompetitionScope = role === 'federation' ? 'admin' : 'organizer'
  const admin = scope === 'admin'
  const { data: me } = useMe()
  // Вкладка в адресе: уведомление «ждёт верификации» ведёт сразу в очередь (?tab=queue)
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'queue' ? 'queue' : 'all'
  const setTab = (next: Tab) => setParams(next === 'queue' ? { tab: next } : {}, { replace: true })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [verification, setVerification] = useState('')
  const [sort, setSort] = useState<CompetitionSort>('date_desc')
  const [form, setForm] = useState<{ open: boolean; item: ManagedCompetition | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })

  const queue = admin && tab === 'queue'
  const filters: CompetitionFilters = {
    search: search.trim() || undefined,
    status: status || undefined,
    verification_status: queue ? 'pending' : verification || undefined,
    // Очередь — по времени запроса (так отдаёт бэк), остальное — как выбрал человек
    sort: queue ? undefined : sort,
  }
  const competitions = useManagedCompetitions(scope, filters, STEP)
  const pendingCount = useManagedCompetitions(scope, { verification_status: 'pending' }, 1)
  const organizers = useOrganizerOptions(admin && form.open)
  const actions = useCompetitionActions(scope)
  const withApplications = useContestsWithApplications(scope)
  const [moderated, setModerated] = useState<{ open: boolean; item: ManagedCompetition | null; key: number }>(
    {
      open: false,
      item: null,
      key: 0,
    },
  )

  const [ready, setReady] = useState<{ open: boolean; item: ManagedCompetition | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })
  const [judged, setJudged] = useState<{ open: boolean; item: ManagedCompetition | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })

  const filtered = Boolean(filters.search || filters.status || (!queue && filters.verification_status))
  const reset = () => {
    setSearch('')
    setStatus('')
    setVerification('')
  }
  const open = (item: ManagedCompetition | null) =>
    setForm((current) => ({ open: true, item, key: current.key + 1 }))

  if (!me) return null
  const self = { value: me.id, label: `${fullName(me)} (вы)` }
  const owner = form.item?.organizer
  const organizerOptions = [
    self,
    ...(owner && owner.id !== me.id && !organizers.data?.some((option) => option.value === owner.id)
      ? [{ value: owner.id, label: owner.full_name }]
      : []),
    ...(organizers.data ?? []).filter((option) => option.value !== me.id),
  ]
  const items = competitions.data?.items ?? []
  const total = competitions.data?.total ?? 0
  const pending = admin ? (pendingCount.data?.total ?? 0) : 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Соревнования' },
        ]}
        title="Соревнования"
        description={
          admin
            ? 'Все соревнования региона. Верифицированные приносят участникам баллы в рейтинг'
            : 'Создавайте, публикуйте и ведите свои соревнования. Верификация ФСП добавит их в рейтинг'
        }
        actions={
          <Button leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
            Создать соревнование
          </Button>
        }
      />

      {admin && (
        <Tabs
          aria-label="Раздел"
          variant="underline"
          value={tab}
          onChange={(next) => {
            setTab(next)
          }}
          items={[
            { value: 'all', label: 'Все' },
            {
              value: 'queue',
              label: (
                <span className="flex items-center gap-2">
                  Очередь верификации{' '}
                  {pending > 0 && <span className="font-mono text-sm text-live-text">{pending}</span>}
                </span>
              ),
            },
          ]}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_13rem] lg:items-end">
        <Field label="Поиск по названию" className="col-span-2 lg:col-span-1">
          <Input
            type="search"
            maxLength={300}
            leftIcon={<IconSearch size={18} />}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
          />
        </Field>
        <Field label="Статус">
          <Select
            value={status}
            options={statusOptions}
            onChange={(event) => {
              setStatus(event.target.value)
            }}
          />
        </Field>
        {!queue && (
          <Field label="Порядок">
            <Select
              value={sort}
              options={sortOptions}
              onChange={(event) => {
                setSort(event.target.value as CompetitionSort)
              }}
            />
          </Field>
        )}
        {!queue && (
          <Field label="Верификация">
            <Select
              value={verification}
              options={verificationOptions}
              onChange={(event) => {
                setVerification(event.target.value)
              }}
            />
          </Field>
        )}
      </div>

      <div className={admin ? '' : 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]'}>
        <div className="min-w-0">
          {competitions.isPending ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((id) => (
                <Skeleton key={id} className="h-96 rounded-xl" />
              ))}
            </div>
          ) : competitions.isError ? (
            <ErrorState error={competitions.error} onRetry={() => competitions.refetch()} />
          ) : !items.length ? (
            <Card>
              <EmptyState
                title={filtered ? 'Ничего не найдено' : queue ? 'Очередь пуста' : 'Соревнований пока нет'}
                description={
                  filtered
                    ? 'Измените поиск или фильтры'
                    : queue
                      ? 'Запросы организаторов на верификацию появятся здесь'
                      : 'Новое соревнование сохранится черновиком'
                }
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={reset}>
                      Сбросить фильтры
                    </Button>
                  ) : queue ? undefined : (
                    <Button leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
                      Создать соревнование
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-6" aria-busy={competitions.isFetching}>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <CompetitionTile
                    key={item.id}
                    item={item}
                    scope={scope}
                    actions={actions}
                    waiting={
                      withApplications.data?.items.find((entry) => entry.contest.id === item.id)?.counts
                        .submitted ?? null
                    }
                    onEdit={() => open(item)}
                    onApplications={() =>
                      setModerated((current) => ({ open: true, item, key: current.key + 1 }))
                    }
                    onJudges={() => setJudged((current) => ({ open: true, item, key: current.key + 1 }))}
                    onReadiness={() => setReady((current) => ({ open: true, item, key: current.key + 1 }))}
                  />
                ))}
              </div>
              {items.length < total && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <Button
                    variant="secondary"
                    loading={competitions.isFetchingNextPage}
                    onClick={() => void competitions.fetchNextPage()}
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
        {!admin && (
          <CalendarAside
            title="Мои ближайшие соревнования"
            marks={items
              .filter((item) => item.status !== 'cancelled')
              .map((item) => ({
                id: item.id,
                title: item.title,
                start: item.starts_on,
                end: item.ends_on,
                to: routes.competition(item.id),
              }))}
          />
        )}
      </div>
      <CompetitionFormModal
        key={form.key}
        open={form.open}
        scope={scope}
        item={form.item}
        actions={actions}
        currentUserId={me.id}
        organizers={organizerOptions}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
      />
      {ready.item && (
        <ReadinessModal
          key={ready.key}
          contest={ready.item}
          open={ready.open}
          onClose={() => setReady((current) => ({ ...current, open: false }))}
        />
      )}
      {judged.item && (
        <JudgePanelModal
          key={judged.key}
          contest={judged.item}
          open={judged.open}
          onClose={() => setJudged((current) => ({ ...current, open: false }))}
        />
      )}
      {moderated.item && (
        <ModerationModal
          key={moderated.key}
          scope={scope}
          contest={moderated.item}
          open={moderated.open}
          onClose={() => setModerated((current) => ({ ...current, open: false }))}
        />
      )}
    </div>
  )
}
