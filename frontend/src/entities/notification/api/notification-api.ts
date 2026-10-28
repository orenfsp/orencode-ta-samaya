import { request, type Query } from '@/shared/api'
import type {
  DeliveryChannel,
  NotificationGroup,
  NotificationPage,
  Preference,
  TelegramStatus,
} from '../model/types'

export const notificationApi = {
  list: (query: Query) => request<NotificationPage>('/notifications', { query }),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  read: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => request<void>('/notifications/read-all', { method: 'POST' }),
  preferences: () => request<{ items: Preference[] }>('/me/notification-settings'),
  savePreferences: (items: { group: NotificationGroup; channel: DeliveryChannel; enabled: boolean }[]) =>
    request<{ items: Preference[] }>('/me/notification-settings', { method: 'PUT', body: { items } }),
  telegram: () => request<TelegramStatus>('/me/telegram'),
  linkTelegram: () => request<{ url: string }>('/me/telegram/link', { method: 'POST' }),
  unlinkTelegram: () => request<void>('/me/telegram', { method: 'DELETE' }),
  test: () => request<void>('/me/notifications/test', { method: 'POST' }),
}
