import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import {
  groupByDay,
  toNotificationItem,
  useNotifications,
  useReadNotifications,
  useUnreadCount,
} from '@/entities/notification'
import { routes } from '@/shared/config'
import {
  Button,
  EmptyState,
  ErrorState,
  NotificationList,
  NotificationListSkeleton,
  PageHeader,
  Tabs,
  showToast,
} from '@/shared/ui'

const STEP = 20
/** Больше бэк за раз не отдаёт */
const MAX = 100

/** Все уведомления: в кабинете роли и отдельной страницей для тех, у кого кабинет ещё закрыт */
export function NotificationsPage() {
  const { role } = useParams()
  const [params, setParams] = useSearchParams()
  const unreadOnly = params.get('filter') === 'unread'
  const [limit, setLimit] = useState(STEP)
  const list = useNotifications(unreadOnly ? { unread_only: true } : {}, limit)
  const count = useUnreadCount()
  const read = useReadNotifications()
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const unread = count.data ?? 0
  const fail = (error: Error) =>
    showToast('Не удалось отметить прочитанным', { tone: 'danger', description: error.message })

  const switchFilter = (next: 'all' | 'unread') => {
    setLimit(STEP)
    setParams(next === 'unread' ? { filter: 'unread' } : {})
  }

  return (
    <section className={role ? 'flex flex-col gap-6' : 'container-page flex flex-col gap-6 py-10'}>
      <PageHeader
        title="Уведомления"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: role ? routes.cabinetRole(role) : routes.cabinet },
          { label: 'Уведомления' },
        ]}
        actions={
          <Button variant="secondary" disabled={!unread} onClick={() => read.mutate(null, { onError: fail })}>
            Прочитать все
          </Button>
        }
      />
      <Tabs
        aria-label="Какие уведомления показать"
        fullWidth
        className="md:w-auto md:self-start"
        value={unreadOnly ? 'unread' : 'all'}
        onChange={switchFilter}
        items={[
          { value: 'all', label: 'Все' },
          { value: 'unread', label: unread ? `Непрочитанные (${unread})` : 'Непрочитанные' },
        ]}
      />
      {list.isPending ? (
        <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-2">
          <NotificationListSkeleton rows={5} />
        </div>
      ) : list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : items.length ? (
        <div className="flex flex-col gap-6">
          {groupByDay(items).map((group) => (
            <section key={group.day} aria-label={group.label} className="flex flex-col gap-2">
              <h2 className="font-mono text-sm text-muted">{group.label}</h2>
              <div className="overflow-hidden rounded-lg border border-line-soft bg-surface-2">
                <NotificationList
                  fullText
                  items={group.items.map((item) => toNotificationItem(item, true))}
                  onOpen={(item) => {
                    if (item.unread) read.mutate(item.id, { onError: fail })
                  }}
                />
              </div>
            </section>
          ))}
          {items.length < total && limit < MAX && (
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="secondary"
                loading={list.isFetching && list.isPlaceholderData}
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
      ) : (
        <EmptyState
          title={unreadOnly ? 'Непрочитанных уведомлений нет' : 'Уведомлений пока нет'}
          description={unreadOnly ? undefined : 'Сюда приходят решения по ролям, заявкам и соревнованиям'}
          action={
            unreadOnly ? (
              <Button variant="secondary" onClick={() => switchFilter('all')}>
                Показать все
              </Button>
            ) : undefined
          }
        />
      )}
    </section>
  )
}
