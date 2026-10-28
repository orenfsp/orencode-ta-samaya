import { request } from '@/shared/api'
import type { Organization, OrganizationInput, OrganizationQuery } from '../model/types'

type Page = { items: Organization[]; total: number }

export const organizationApi = {
  search: (query: OrganizationQuery, signal?: AbortSignal) =>
    request<Page>('/organizations', { query: { ...query }, signal }),
  admin: (query: OrganizationQuery, signal?: AbortSignal) =>
    request<Page>('/admin/organizations', { query: { ...query }, signal }),
  create: (input: OrganizationInput) =>
    request<Organization>('/admin/organizations', { method: 'POST', body: input }),
  update: (id: number, input: OrganizationInput) =>
    request<Organization>(`/admin/organizations/${id}`, { method: 'PATCH', body: input }),
}
