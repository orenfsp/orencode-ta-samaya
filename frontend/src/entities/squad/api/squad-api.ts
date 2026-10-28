import { request } from '@/shared/api'
import type { Squad, SquadApproved, SquadBadge, SquadDraft, SquadForm, SquadTarget } from '../model/types'

export const squadApi = {
  list: (target: Partial<SquadTarget>, signal?: AbortSignal) =>
    request<{ items: Squad[] }>('/squads', { query: { ...target }, signal }),
  badges: (userId: string, signal?: AbortSignal) =>
    request<{ items: SquadBadge[] }>(`/squads/members/${userId}`, { signal }),
  draft: (target: SquadTarget, mainSize: number, reserveSize: number, signal?: AbortSignal) =>
    request<SquadDraft>('/admin/squads/candidates', {
      query: { ...target, main_size: mainSize, reserve_size: reserveSize },
      signal,
    }),
  approve: (form: SquadForm) => request<SquadApproved>('/admin/squads', { method: 'POST', body: form }),
  dissolve: (id: number) => request<void>(`/admin/squads/${id}`, { method: 'DELETE' }),
}
