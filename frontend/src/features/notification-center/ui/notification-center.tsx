import { useState } from 'react'
import { toNotificationItem, useNotifications, useReadNotifications } from '@/entities/notification'
import { useMe } from '@/entities/session'
import { routes } from '@/shared/config'
import { NotificationBell, showToast } from '@/shared/ui'
import { useNotificationSync } from '../model/use-notification-sync'

/** Колокольчик в шапке сайта: счётчик всегда, лента — после первого открытия */
export function NotificationCenter({ tone = 'canvas' }: { tone?: 'canvas' | 'paper' }) {
  const { data: me } = useMe()
  const unread = useNotificationSync(Boolean(me))
  const [opened, setOpened] = useState(false)
  const list = useNotifications({}, 8, Boolean(me) && opened)
  const read = useReadNotifications()
  if (!me) return null
  const role = me.available_roles[0]
  const fail = (error: Error) => showToast(error.message, { tone: 'danger' })
  return (
    <NotificationBell
      tone={tone}
      unreadCount={unread}
      loading={list.isPending}
      error={list.error}
      onShow={() => (opened ? void list.refetch() : setOpened(true))}
      onRetry={() => void list.refetch()}
      allTo={role ? routes.cabinetNotifications(role) : routes.notifications}
      items={(list.data?.items ?? []).map((item) => toNotificationItem(item))}
      onOpen={(item) => {
        if (item.unread) read.mutate(item.id, { onError: fail })
      }}
      onReadAll={() => read.mutate(null, { onError: fail })}
    />
  )
}
