import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { notificationKeys, useUnreadCount } from '@/entities/notification'
import { sessionKeys } from '@/entities/session'

/**
 * Счётчик непрочитанных для шапки и меню кабинета. Монтировать один раз на экран.
 * Пришло новое — перечитываем ленту и /me: решение по роли сразу открывает кабинет.
 */
export function useNotificationSync(enabled: boolean) {
  const client = useQueryClient()
  const count = useUnreadCount(enabled)
  const previous = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (count.data === undefined) return
    if (previous.current !== undefined && count.data > previous.current) {
      void client.invalidateQueries({ queryKey: notificationKeys.lists })
      void client.invalidateQueries({ queryKey: sessionKeys.me })
    }
    previous.current = count.data
  }, [count.data, client])
  return count.data ?? 0
}
