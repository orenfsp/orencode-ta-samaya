import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { organizationApi } from '../api/organization-api'
import type { OrganizationQuery } from './types'

export const organizationKeys = {
  all: ['organizations'] as const,
  search: (query: OrganizationQuery) => ['organizations', 'search', query] as const,
  admin: (query: OrganizationQuery) => ['organizations', 'admin', query] as const,
}

/** Выбор организации в профиле: активные, поиск по названию */
export function useOrganizationOptions(q = '') {
  const query = { q: q.trim() || undefined, limit: 100, offset: 0 }
  return useQuery({
    queryKey: organizationKeys.search(query),
    queryFn: ({ signal }) => organizationApi.search(query, signal),
    staleTime: 60_000,
  })
}

export function useAdminOrganizations(query: OrganizationQuery) {
  return useQuery({
    queryKey: organizationKeys.admin(query),
    queryFn: ({ signal }) => organizationApi.admin(query, signal),
    placeholderData: keepPreviousData,
  })
}
