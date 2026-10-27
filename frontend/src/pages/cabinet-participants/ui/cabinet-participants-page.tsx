import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import {
  useContestsWithApplications,
  useModeratedApplications,
  type ApplicationStatus,
  type ContestWithApplications,
  type ModerationScope,
} from '@/entities/application'
import { competitionDates } from '@/entities/competition'
import type { Role } from '@/entities/session'
import { ModeratedRow, RejectModal, useModeration } from '@/features/application-moderate'
import { routes } from '@/shared/config'
import { cn, plural, useSelection } from '@/shared/lib'
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  IconChevronLeft,
  IconSearch,
  Input,
  PageHeader,
  SelectionBar,
  Skeleton,
  Tabs,
  TextLink,
} from '@/shared/ui'
import { CalendarAside } from '@/widgets/calendar-aside'

const STEP = 30

type Filter = 'submitted' | 'approved' | 'rejected' | 'forming' | 'all'
const filters: Filter[] = ['submitted', 'approved', 'rejected', 'forming', 'all']
const filterTitles: Record<Filter, string> = {
  submitted: 'На рассмотрении',
  approved: 'Одобрены',
  rejected: 'Отклонены',
  forming: 'Собираются',
  all: 'Все',
}

function ContestButton({
  item,
  active,
  onSelect,
}: {
  item: ContestWithApplications
  active: boolean
  onSelect: () => void
}) {
  const { contest, counts } = item
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active || undefined}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left transition-colors outline-none focus-visible:field-focus',
        active
          ? 'border-primary bg-primary-soft'
          : 'border-line-soft bg-surface-2 hover:border-line light:bg-surface',
      )}
    >
      <span className="line-clamp-2 text-body text-ink">{contest.title}</span>
      <span className="text-sm text-muted">
        {competitionDates(contest)} · {contest.participation_type_title}
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
        {counts.submitted > 0 && <span className="text-live-text">ждут {counts.submitted}</span>}
        <span className="text-muted">одобрено {counts.approved}</span>
        {counts.forming > 0 && <span className="text-muted">собираются {counts.forming}</span>}
      </span>
    </button>
  )
}

/** Модерация участников: организатор — свои соревнования, федерация — все. Сначала соревнование, потом заявки */
export function CabinetParticipantsPage() {
  const role = useParams().role as Role
  const scope: ModerationScope = role === 'federation' ? 'admin' : 'organizer'
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(STEP)
  const [bulkReject, setBulkReject] = useState(false)
  const selection = useSelection<number>()
  const moderation = useModeration(scope)
  const contests = useContestsWithApplications(scope)

  const contestId = Number(params.get('contest')) || null
  const rawFilter = params.get('status') as Filter | null
  const filter: Filter = rawFilter && filters.includes(rawFilter) ? rawFilter : 'submitted'
  const search = params.get('q') ?? ''
  const update = (values: Record<string, string>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )
    setLimit(STEP)
    selection.clear()
  }

  const list = contests.data?.items ?? []
  const selected = list.find((item) => item.contest.id === contestId) ?? null
  const applications = useModeratedApplications(
    scope,
    selected ? contestId : null,
    {
      status: filter === 'all' ? undefined : (filter as ApplicationStatus),
      search: search.trim() || undefined,
    },
    limit,
  )
  const items = applications.data?.items ?? []
  const total = applications.data?.total ?? 0
  const pendingIds = items.filter((item) => item.status === 'submitted').map((item) => item.id)
  const marks = list.map(({ contest }) => ({
    id: contest.id,
    title: contest.title,
    start: contest.starts_on,
    end: contest.ends_on,
    to: `?contest=${contest.id}`,
  }))
  const title = 'Модерация участников'

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: title },
        ]}
        title={title}
        description={
          role === 'federation'
            ? 'Заявки на все соревнования региона. Одобренные участники попадают в протокол'
            : 'Заявки на ваши соревнования. Одобренные участники попадают в протокол'
        }
      />

      <div className="grid gap-8 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className={cn('flex flex-col gap-6', selected && 'hidden xl:flex')}>
          {contests.isPending ? (
            [1, 2, 3].map((id) => <Skeleton key={id} className="h-28 rounded-lg" />)
          ) : contests.isError ? (
            <ErrorState error={contests.error} onRetry={() => contests.refetch()} />
          ) : !list.length ? (
            <Card>
              <EmptyState
                title="Заявок пока нет"
                description="Соревнования появятся здесь, когда на них подадут первые заявки"
                action={
                  <Button variant="secondary" to={routes.cabinetCompetitions(role)}>
                    Соревнования
                  </Button>
                }
              />
            </Card>
          ) : (
            <nav aria-label="Соревнования с заявками" className="flex flex-col gap-2">
              {list.map((item) => (
                <ContestButton
                  key={item.contest.id}
                  item={item}
                  active={item.contest.id === contestId}
                  onSelect={() => update({ contest: String(item.contest.id), status: '', q: '' })}
                />
              ))}
            </nav>
          )}
          <CalendarAside
            marks={marks}
            title="Ближайшие с заявками"
            markLabel="С заявками"
            className="hidden xl:flex"
          />
        </div>

        <div className={cn('flex min-w-0 flex-col gap-6', !selected && 'hidden xl:flex')}>
          {!selected ? (
            <Card>
              <EmptyState
                title="Выберите соревнование"
                description="Слева соревнования с заявками. Сверху те, где заявки ждут решения"
              />
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <Button
                  variant="text"
                  size="sm"
                  leftIcon={<IconChevronLeft size={16} />}
                  className="self-start xl:hidden"
                  onClick={() => update({ contest: '' })}
                >
                  Все соревнования
                </Button>
                <h2 className="text-h3 font-medium text-balance">{selected.contest.title}</h2>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span>{competitionDates(selected.contest)}</span>
                  <span>{selected.contest.status_title}</span>
                  {role === 'federation' && <span>Организатор: {selected.contest.organizer.last_name}</span>}
                  <TextLink to={routes.competition(selected.contest.id)}>Карточка соревнования</TextLink>
                </p>
              </div>

              <Tabs
                aria-label="Статус заявок"
                variant="underline"
                value={filter}
                onChange={(next) => update({ status: next === 'submitted' ? '' : next })}
                items={filters.map((value) => {
                  const count = value === 'all' ? null : selected.counts[value as ApplicationStatus]
                  return {
                    value,
                    label: (
                      <span className="flex items-center gap-2">
                        {filterTitles[value]}
                        {count ? (
                          <span
                            className={cn(
                              'font-mono text-sm tabular-nums',
                              value === 'submitted' ? 'text-live-text' : 'text-muted',
                            )}
                          >
                            {count}
                          </span>
                        ) : null}
                      </span>
                    ),
                  }
                })}
              />

              <div className="flex flex-wrap items-end gap-4">
                <Field label="Команда, ФИО или email" className="min-w-0 flex-1">
                  <Input
                    type="search"
                    maxLength={200}
                    leftIcon={<IconSearch size={18} />}
                    value={search}
                    onChange={(event) => update({ q: event.target.value })}
                  />
                </Field>
                {pendingIds.length > 1 && (
                  <Checkbox
                    label="Выбрать все на рассмотрении"
                    checked={selection.allOf(pendingIds)}
                    indeterminate={selection.someOf(pendingIds)}
                    onChange={() => selection.toggleAll(pendingIds)}
                    className="pb-3"
                  />
                )}
              </div>

              {applications.isPending ? (
                <Card padding="none">
                  <ul className="divide-y divide-line-soft">
                    {[1, 2, 3].map((id) => (
                      <li key={id} className="flex flex-col gap-3 px-5 py-4">
                        <Skeleton className="h-4 w-56 max-w-full" />
                        <Skeleton className="h-10 w-72 max-w-full" />
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : applications.isError ? (
                <ErrorState error={applications.error} onRetry={() => applications.refetch()} />
              ) : !items.length ? (
                <Card>
                  <EmptyState
                    title={search ? 'Никого не нашли' : `${filterTitles[filter]}: пусто`}
                    description={search ? 'Измените поиск' : 'Выберите другой статус'}
                    action={
                      search ? (
                        <Button variant="secondary" onClick={() => update({ q: '' })}>
                          Сбросить поиск
                        </Button>
                      ) : undefined
                    }
                  />
                </Card>
              ) : (
                <div className="flex flex-col gap-6" aria-busy={applications.isFetching}>
                  <Card padding="none">
                    <ul className="divide-y divide-line-soft">
                      {items.map((item) => (
                        <ModeratedRow
                          key={item.id}
                          item={item}
                          moderation={moderation}
                          selected={selection.has(item.id)}
                          onToggle={() => selection.toggle(item.id)}
                        />
                      ))}
                    </ul>
                  </Card>
                  {items.length < total && (
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <Button
                        variant="secondary"
                        loading={applications.isFetching}
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
            </>
          )}
        </div>
      </div>

      <SelectionBar count={selection.count} onClear={selection.clear} noun={['заявка', 'заявки', 'заявок']}>
        <Button
          size="sm"
          loading={moderation.approve.isPending}
          onClick={() => moderation.approve.mutate(selection.selected, { onSuccess: selection.clear })}
        >
          Одобрить
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setBulkReject(true)}>
          Отклонить
        </Button>
      </SelectionBar>

      {bulkReject && (
        <RejectModal
          title={`Отклонить ${selection.count} ${plural(selection.count, ['заявку', 'заявки', 'заявок'])}?`}
          description="Одна причина для всех выбранных. Участники её увидят"
          pending={moderation.reject.isPending}
          error={moderation.reject.error}
          onClose={() => setBulkReject(false)}
          onSubmit={(reason) =>
            moderation.reject.mutate(
              { ids: selection.selected, reason },
              {
                onSuccess: () => {
                  setBulkReject(false)
                  selection.clear()
                },
              },
            )
          }
        />
      )}
    </div>
  )
}
