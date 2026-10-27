import { roleLabels, roleStatusLabels, type RoleStatus } from '@/entities/session'
import type { StatusTone } from '@/shared/ui'
import type { ModeratedRole } from './types'

export const moderatedRoles: ModeratedRole[] = ['coach', 'judge', 'organizer', 'federation']

export const roleTitles: Record<ModeratedRole, string> = roleLabels

/** Подписи вкладок страницы модерации */
export const roleTabTitles: Record<ModeratedRole, string> = {
  coach: 'Тренеры',
  judge: 'Судьи',
  organizer: 'Организации',
  federation: 'Федерация',
}

export const statusTitles = roleStatusLabels

export const statusTones: Record<RoleStatus, StatusTone> = {
  pending: 'draft',
  verified: 'active',
  rejected: 'cancelled',
}

/** Что теряет человек, если роль вернуть на проверку */
export const resetConsequence: Record<ModeratedRole, string> = {
  coach: 'Тренер продолжит работать, но без значка подтверждения',
  judge: 'Кабинет судьи закроется до нового решения',
  organizer: 'Кабинет организации закроется до нового решения',
  federation: 'Доступ к кабинету федерации закроется до нового решения',
}
