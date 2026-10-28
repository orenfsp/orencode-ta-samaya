import { formatDate } from '@/shared/lib'
import type { StatusTone } from '@/shared/ui'

/** За сколько дней срок считается «истекает»: как первый порог напоминаний на бэке */
export const EXPIRING_DAYS = 30

const DAY = 86_400_000

export function daysLeft(validUntil: string, now = new Date()) {
  const end = new Date(`${validUntil}T23:59:59`)
  return Math.ceil((end.getTime() - now.getTime()) / DAY) - 1
}

/** Срок одобренной квалификации: тон метки и короткая подпись */
export function validity(validUntil: string | null, now = new Date()): { tone: StatusTone; label: string } {
  if (validUntil === null) return { tone: 'active', label: 'Бессрочно' }
  const left = daysLeft(validUntil, now)
  if (left < 0) return { tone: 'cancelled', label: `Истекла ${formatDate(validUntil)}` }
  if (left <= EXPIRING_DAYS) return { tone: 'live', label: `Истекает через ${left} дн.` }
  return { tone: 'active', label: `Действует до ${formatDate(validUntil)}` }
}

export const isValidNow = (validUntil: string | null, now = new Date()) =>
  validUntil === null || daysLeft(validUntil, now) >= 0
