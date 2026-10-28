import { request } from '@/shared/api'
import type { ConsentInput, ConsentRow, ConsentStatus, MyConsent } from '../model/types'

export const consentApi = {
  mine: (signal?: AbortSignal) => request<MyConsent>('/me/guardian-consent', { signal }),
  submit: (body: ConsentInput) =>
    request<MyConsent['consent']>('/me/guardian-consent', { method: 'PUT', body }),
  queue: (
    filters: { status?: ConsentStatus; search?: string },
    limit: number,
    offset: number,
    signal?: AbortSignal,
  ) =>
    request<{ items: ConsentRow[]; total: number }>('/admin/guardian-consents', {
      query: { ...filters, limit, offset },
      signal,
    }),
  count: (signal?: AbortSignal) => request<{ pending: number }>('/admin/guardian-consents/count', { signal }),
  approve: (id: string) => request<ConsentRow>(`/admin/guardian-consents/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    request<ConsentRow>(`/admin/guardian-consents/${id}/reject`, { method: 'POST', body: { reason } }),
}
