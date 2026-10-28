import { request, type Query } from '@/shared/api'
import type { AuditCatalog, AuditPage } from '../model/types'

export const auditApi = {
  list: (query: Query) => request<AuditPage>('/admin/audit', { query }),
  catalog: () => request<AuditCatalog>('/admin/audit/catalog'),
}
