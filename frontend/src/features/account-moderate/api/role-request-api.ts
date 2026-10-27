import { request } from '@/shared/api'
import type { RoleRequest, RoleRequestCounts, RoleRequestFilters, RoleRequestPage } from '../model/types'

const base = '/admin/role-requests'

export const roleRequestApi = {
  list: (filters: RoleRequestFilters, limit: number, offset = 0, signal?: AbortSignal) =>
    request<RoleRequestPage>(base, { query: { ...filters, limit, offset }, signal }),
  counts: (signal?: AbortSignal) => request<RoleRequestCounts>(`${base}/counts`, { signal }),
  approve: (id: string) => request<RoleRequest>(`${base}/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    request<RoleRequest>(`${base}/${id}/reject`, { method: 'POST', body: { reason } }),
  reset: (id: string, reason?: string) =>
    request<RoleRequest>(`${base}/${id}/reset`, { method: 'POST', body: { reason: reason || null } }),
}
