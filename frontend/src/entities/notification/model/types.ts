export type EmailStatus = 'not_required' | 'pending' | 'sent' | 'failed'

export interface Notification {
  id: string
  type: string
  title: string
  text: string
  link: string | null
  is_read: boolean
  email_status: EmailStatus
  email_sent_at: string | null
  created_at: string
}

export interface NotificationPage {
  items: Notification[]
  total: number
}

export type NotificationGroup = 'security' | 'roles' | 'contests' | 'applications' | 'moderation'
export type DeliveryChannel = 'email' | 'telegram'

/** Строка настроек: какие группы событий в какой канал. security выключить нельзя */
export interface Preference {
  group: NotificationGroup
  label: string
  description: string
  email: boolean
  telegram: boolean
  locked: boolean
}

export interface TelegramStatus {
  /** На сервере задан токен бота */
  available: boolean
  bot: string
  linked: boolean
  username: string | null
  linked_at: string | null
  /** Почтовый ящик для проверки писем на демо-стенде */
  mailpit_url: string | null
}

export interface NotificationFilters {
  unread_only?: boolean
}
