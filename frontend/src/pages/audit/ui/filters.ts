export const auditFilterKeys = ['q', 'user_id', 'action', 'object_type', 'date_from', 'date_to'] as const

export type AuditFilterKey = (typeof auditFilterKeys)[number]
export type AuditFilterValues = Record<AuditFilterKey, string>

export const readAuditFilters = (params: URLSearchParams): AuditFilterValues =>
  Object.fromEntries(auditFilterKeys.map((key) => [key, params.get(key) ?? ''])) as AuditFilterValues
