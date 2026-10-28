import { useState } from 'react'
import {
  useContestsWithApplications,
  useModeratedApplications,
  type ApplicationStatus,
  type ModerationScope,
} from '@/entities/application'
import { cn, plural, useSelection } from '@/shared/lib'
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  IconSearch,
  Input,
  Modal,
  Skeleton,
  Tabs,
  ReasonModal,
} from '@/shared/ui'
import { useModeration } from '../model/use-moderation'
import { ModeratedRow } from './moderated-row'

const STEP = 30
/** Больше бэк за раз не отдаёт */
const MAX = 200

type Filter = 'submitted' | 'approved' | 'rejected' | 'forming' | 'all'
const filters: Filter[] = ['submitted', 'approved', 'rejected', 'forming', 'all']
const filterTitles: Record<Filter, string> = {
  submitted: 'На рассмотрении',
  approved: 'Одобрены',
  rejected: 'Отклонены',
  forming: 'Собираются',
  all: 'Все',
}

/**
 * Заявки участников на одно соревнование: организатор — на свои, федерация — на любые.
 * Открывается из карточки соревнования; отдельного раздела модерации нет.
 */
export function ModerationModal({
  scope,
  contest,
  open,
  onClose,
}: {
  scope: ModerationScope
  contest: { id: number; title: string }
  open: boolean
  onClose: () => void
}) {
  const [filter, setFilter] = useState<Filter>('submitted')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(STEP)
  const [bulkReject, setBulkReject] = useState(false)
  const selection = useSelection<number>()
  const moderation = useModeration(scope)
  const contests = useContestsWithApplications(scope)
  const counts = contests.data?.items.find((item) => item.contest.id === contest.id)?.counts
  const applications = useModeratedApplications(
    scope,
    open ? contest.id : null,
    {
      status: filter === 'all' ? undefined : (filter as ApplicationStatus),
      search: search.trim() || undefined,
    },
    limit,
  )
  const items = applications.data?.items ?? []
  const total = applications.data?.total ?? 0
  const pendingIds = items.filter((item) => item.status === 'submitted').map((item) => item.id)
  const changed = () => {
    setLimit(STEP)
    selection.clear()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Заявки участников"
      description={contest.title}
      footer={
        selection.count > 0 ? (
          <>
            <span className="mr-auto self-center font-mono text-sm text-muted tabular-nums">
              Выбрано {selection.count}
            </span>
            <Button variant="ghost" onClick={() => setBulkReject(true)}>
              Отклонить
            </Button>
            <Button
              loading={moderation.approve.isPending}
              onClick={() => moderation.approve.mutate(selection.selected, { onSuccess: selection.clear })}
            >
              Одобрить
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 pb-1">
        <Tabs
          aria-label="Статус заявок"
          variant="underline"
          value={filter}
          onChange={(next) => {
            setFilter(next)
            changed()
          }}
          items={filters.map((value) => {
            const count = value === 'all' ? null : counts?.[value as ApplicationStatus]
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
              onChange={(event) => {
                setSearch(event.target.value)
                changed()
              }}
            />
          </Field>
          {pendingIds.length > 1 && (
            <Checkbox
              label="Выбрать все"
              checked={selection.allOf(pendingIds)}
              indeterminate={selection.someOf(pendingIds)}
              onChange={() => selection.toggleAll(pendingIds)}
              className="pb-3"
            />
          )}
        </div>

        {applications.isPending ? (
          <ul className="divide-y divide-line-soft rounded-lg border border-line-soft">
            {[1, 2, 3].map((id) => (
              <li key={id} className="flex flex-col gap-3 px-5 py-4">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-10 w-72 max-w-full" />
              </li>
            ))}
          </ul>
        ) : applications.isError ? (
          <ErrorState error={applications.error} onRetry={() => applications.refetch()} />
        ) : !items.length ? (
          <EmptyState
            title={search ? 'Никого не нашли' : 'Заявок нет'}
            description={search ? 'Измените поиск' : 'Выберите другой статус'}
            action={
              search ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    changed()
                  }}
                >
                  Сбросить поиск
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-5" aria-busy={applications.isFetching}>
            <ul className="divide-y divide-line-soft rounded-lg border border-line-soft">
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
            {items.length < total && limit < MAX && (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="secondary"
                  loading={applications.isFetching}
                  onClick={() => setLimit((current) => Math.min(MAX, current + STEP))}
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

      <ReasonModal
        open={bulkReject}
        label="Причина отказа"
        confirmLabel="Отклонить"
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
    </Modal>
  )
}
