import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  groupByDay,
  toNotificationItem,
  useNotifications,
  useReadNotifications,
} from '@/entities/notification'
import { routes } from '@/shared/config'
import {
  Button,
  EmptyState,
  ErrorState,
  IconBell,
  IconButton,
  NotificationList,
  NotificationListSkeleton,
  Sheet,
  showToast,
  Tabs,
  UnreadMark,
} from '@/shared/ui'

const STEP = 20
/** Больше бэк за раз не отдаёт */
const MAX = 100

/**
 * Центр уведомлений кабинета: колокольчик у переключателя темы, лента — панелью справа.
 * Лента грузится при первом открытии; полная страница — по ссылке внизу панели.
 */
export function NotificationSheet({ role, unread }: { role: string; unread: number }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [limit, setLimit] = useState(STEP)
  const list = useNotifications(filter === 'unread' ? { unread_only: true } : {}, limit, opened)
  const read = useReadNotifications()
  const fail = (error: Error) => showToast(error.message, { tone: 'danger' })
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0

  const show = () => {
    setOpened(true)
    setOpen(true)
    if (opened) void list.refetch()
  }

  return (
    <>
      <span className="relative">
        <IconButton
          aria-label={unread ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'}
          icon={<IconBell size={18} />}
          size="sm"
          onClick={show}
        />
        <UnreadMark count={unread} className="pointer-events-none absolute -top-0.5 -right-0.5" />
      </span>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Уведомления"
        actions={
          <Button
            variant="text"
            size="sm"
            disabled={!unread}
            onClick={() => read.mutate(null, { onError: fail })}
          >
            Прочитать все
          </Button>
        }
        footer={
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setOpen(false)
              navigate(routes.cabinetNotifications(role))
            }}
          >
            Все уведомления
          </Button>
        }
      >
        <div className="border-b border-line-soft px-5 py-3">
          <Tabs
            aria-label="Какие показывать"
            fullWidth
            value={filter}
            onChange={(next) => {
              setFilter(next)
              setLimit(STEP)
            }}
            items={[
              { value: 'all', label: 'Все' },
              { value: 'unread', label: unread ? `Непрочитанные · ${unread}` : 'Непрочитанные' },
            ]}
          />
        </div>
        {list.isPending ? (
          <NotificationListSkeleton rows={5} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !items.length ? (
          <EmptyState
            icon={<IconBell size={26} />}
            title={filter === 'unread' ? 'Непрочитанных нет' : 'Уведомлений пока нет'}
          />
        ) : (
          <div className="flex flex-col">
            {groupByDay(items).map((group) => (
              <section key={group.day}>
                <h3 className="sticky top-0 z-10 bg-surface-2 px-5 pt-4 pb-2 font-mono text-xs text-muted">
                  {group.label}
                </h3>
                <NotificationList
                  items={group.items.map((item) => toNotificationItem(item, true))}
                  onOpen={(item) => {
                    if (item.unread) read.mutate(item.id, { onError: fail })
                    if (item.to) setOpen(false)
                  }}
                />
              </section>
            ))}
            {items.length < total && limit < MAX && (
              <div className="p-4">
                <Button
                  variant="secondary"
                  fullWidth
                  loading={list.isFetching}
                  onClick={() => setLimit((value) => Math.min(MAX, value + STEP))}
                >
                  Показать ещё
                </Button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
}
