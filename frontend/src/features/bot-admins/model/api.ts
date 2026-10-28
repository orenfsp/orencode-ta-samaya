import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/shared/api'
import { showToast } from '@/shared/ui'

export type BotAdminLevel = 'moderator' | 'admin' | 'owner'

export interface BotAdmin {
  user_id: string
  full_name: string
  email: string
  level: BotAdminLevel
  linked: boolean
  granted_by: string | null
  created_at: string
}

export interface BotAdmins {
  my_level: BotAdminLevel | null
  can_manage: boolean
  levels: { code: BotAdminLevel; label: string; rights: string[] }[]
  items: BotAdmin[]
}

const base = '/admin/telegram/admins'
export const botAdminKeys = { all: ['bot-admins'] as const }

export const useBotAdmins = () =>
  useQuery({ queryKey: botAdminKeys.all, queryFn: () => request<BotAdmins>(base) })

/** Назначение, смена уровня и снятие. После любого — свежий список */
export function useBotAdminActions() {
  const client = useQueryClient()
  const done = (title: string) => () => {
    showToast(title, { tone: 'success' })
    void client.invalidateQueries({ queryKey: botAdminKeys.all })
  }
  const fail = (error: Error) => showToast('Не получилось', { tone: 'danger', description: error.message })
  return {
    grant: useMutation({
      mutationFn: (body: { email: string; level: BotAdminLevel }) =>
        request<void>(base, { method: 'POST', body }),
      onSuccess: done('Администратор назначен'),
    }),
    change: useMutation({
      mutationFn: ({ id, level }: { id: string; level: BotAdminLevel }) =>
        request<void>(`${base}/${id}`, { method: 'PATCH', body: { level } }),
      onSuccess: done('Уровень изменён'),
      onError: fail,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => request<void>(`${base}/${id}`, { method: 'DELETE' }),
      onSuccess: done('Администратор снят'),
      onError: fail,
    }),
  }
}
