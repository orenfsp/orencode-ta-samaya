import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { auditApi } from '../api/audit-api'
import type { AuditFilters } from './types'

export const auditKeys = {
  all: ['audit'] as const,
  list: (query: object) => ['audit', 'list', query] as const,
  catalog: ['audit', 'catalog'] as const,
}

/** Журнал постранично: limit + offset, порядок по времени. Прошлая страница не мигает при переходе */
export const useAuditLog = (
  filters: AuditFilters,
  page: { limit: number; offset: number; order: 'desc' | 'asc' },
  enabled = true,
) =>
  useQuery({
    queryKey: auditKeys.list({ ...filters, ...page }),
    queryFn: () => auditApi.list({ ...filters, ...page }),
    placeholderData: keepPreviousData,
    enabled,
  })

/** Все действия и типы объектов для фильтров — меняются только с релизом */
export const useAuditCatalog = (enabled = true) =>
  useQuery({ queryKey: auditKeys.catalog, queryFn: auditApi.catalog, staleTime: 10 * 60_000, enabled })
