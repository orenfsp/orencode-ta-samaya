import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { auditKeys } from '@/entities/audit'
import { sessionKeys } from '@/entities/session'
import { showToast } from '@/shared/ui'
import { roleRequestApi } from '../api/role-request-api'
import { roleTitles } from './labels'
import type { RoleRequest, RoleRequestFilters } from './types'

export const roleRequestKeys = {
  all: ['role-requests'] as const,
  list: (filters: RoleRequestFilters, limit: number, offset: number) =>
    ['role-requests', 'list', filters, limit, offset] as const,
  counts: ['role-requests', 'counts'] as const,
}

/** Постранично: limit + offset; прежняя страница остаётся на экране, пока грузится новая */
export function useRoleRequests(filters: RoleRequestFilters, limit: number, offset: number, enabled = true) {
  return useQuery({
    queryKey: roleRequestKeys.list(filters, limit, offset),
    queryFn: ({ signal }) => roleRequestApi.list(filters, limit, offset, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useRoleRequestCounts() {
  return useQuery({
    queryKey: roleRequestKeys.counts,
    queryFn: ({ signal }) => roleRequestApi.counts(signal),
  })
}

const who = (item: RoleRequest) => `${item.user.last_name} ${item.user.first_name}`

/** Решения по ролям. После каждого — свежие списки и счётчики; свой /me тоже, на случай совмещённых ролей */
export function useRoleModeration() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: roleRequestKeys.all }),
      client.invalidateQueries({ queryKey: sessionKeys.me }),
      client.invalidateQueries({ queryKey: auditKeys.all }),
    ])
  const fail = (title: string) => (error: Error) =>
    showToast(title, { tone: 'danger', description: error.message })

  const approve = useMutation({
    mutationFn: (item: RoleRequest) => roleRequestApi.approve(item.id),
    onSuccess: (item) => {
      void refresh()
      showToast(`${who(item)}: роль «${roleTitles[item.role]}» подтверждена`, { tone: 'success' })
    },
    onError: fail('Не получилось подтвердить'),
  })

  const reject = useMutation({
    mutationFn: ({ item, reason }: { item: RoleRequest; reason: string }) =>
      roleRequestApi.reject(item.id, reason),
    onSuccess: (item) => {
      void refresh()
      showToast(`${who(item)}: роль «${roleTitles[item.role]}» отклонена`, { tone: 'success' })
    },
  })

  const reset = useMutation({
    mutationFn: ({ item, reason }: { item: RoleRequest; reason?: string }) =>
      roleRequestApi.reset(item.id, reason),
    onSuccess: (item) => {
      void refresh()
      showToast(`${who(item)}: роль «${roleTitles[item.role]}» снова на проверке`, { tone: 'success' })
    },
  })

  return { approve, reject, reset }
}

export type RoleModeration = ReturnType<typeof useRoleModeration>
