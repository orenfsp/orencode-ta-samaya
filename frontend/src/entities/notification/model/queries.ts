import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { notificationApi } from '../api/notification-api'
import type { NotificationFilters, NotificationPage } from './types'

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: ['notifications', 'list'] as const,
  list: (query: object) => ['notifications', 'list', query] as const,
  count: ['notifications', 'count'] as const,
  preferences: ['notifications', 'preferences'] as const,
  telegram: ['notifications', 'telegram'] as const,
}

export const usePreferences = () =>
  useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: notificationApi.preferences,
    select: (data) => data.items,
  })

/** Статус Telegram. Пока ждём привязку в боте — опрашиваем раз в 3 с, после привязки перестаём */
export const useTelegramStatus = (waiting = false) =>
  useQuery({
    queryKey: notificationKeys.telegram,
    queryFn: notificationApi.telegram,
    refetchInterval: (query) => (waiting && !query.state.data?.linked ? 3000 : false),
  })

/** Счётчик непрочитанных: опрос раз в 30 с, пока вкладка открыта */
export const useUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: notificationKeys.count,
    queryFn: notificationApi.unreadCount,
    select: (data) => data.count,
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

/** Лента: «Показать ещё» увеличивает limit, прошлые строки не мигают */
export const useNotifications = (filters: NotificationFilters, limit: number, enabled = true) =>
  useQuery({
    queryKey: notificationKeys.list({ ...filters, limit }),
    queryFn: () => notificationApi.list({ ...filters, limit }),
    placeholderData: keepPreviousData,
    enabled,
  })

type Snapshot = {
  lists: [readonly unknown[], NotificationPage | undefined][]
  count: { count: number } | undefined
}

async function markRead(client: QueryClient, id: string | null): Promise<Snapshot> {
  await client.cancelQueries({ queryKey: notificationKeys.all })
  const snapshot: Snapshot = {
    lists: client.getQueriesData<NotificationPage>({ queryKey: notificationKeys.lists }),
    count: client.getQueryData<{ count: number }>(notificationKeys.count),
  }
  client.setQueriesData<NotificationPage>({ queryKey: notificationKeys.lists }, (page) =>
    page
      ? {
          ...page,
          items: page.items.map((item) =>
            id === null || item.id === id ? { ...item, is_read: true } : item,
          ),
        }
      : page,
  )
  if (snapshot.count)
    client.setQueryData(notificationKeys.count, {
      count: id === null ? 0 : Math.max(0, snapshot.count.count - 1),
    })
  return snapshot
}

function restore(client: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.lists.forEach(([key, data]) => client.setQueryData(key, data))
  if (snapshot?.count) client.setQueryData(notificationKeys.count, snapshot.count)
}

/** Прочитать одно (id) или все (null): сразу на экране, при ошибке — откат */
export function useReadNotifications() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string | null) => (id ? notificationApi.read(id) : notificationApi.readAll()),
    onMutate: (id) => markRead(client, id),
    onError: (_error, _id, snapshot) => restore(client, snapshot),
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
