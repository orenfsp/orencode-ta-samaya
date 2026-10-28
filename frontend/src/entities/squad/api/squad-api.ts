import { request } from '@/shared/api'
import { env } from '@/shared/config'
import type { Squad, SquadApproved, SquadBadge, SquadDraft, SquadForm, SquadTarget } from '../model/types'

export const squadApi = {
  list: (target: Partial<SquadTarget>, signal?: AbortSignal) =>
    request<{ items: Squad[] }>('/squads', { query: { ...target }, signal }),
  badges: (userId: string, signal?: AbortSignal) =>
    request<{ items: SquadBadge[] }>(`/squads/members/${userId}`, { signal }),
  draft: (
    target: SquadTarget,
    mainSize: number,
    reserveSize: number,
    minRank?: number,
    excludeIds: string[] = [],
    signal?: AbortSignal,
  ) =>
    request<SquadDraft>('/admin/squads/candidates', {
      query: {
        ...target,
        main_size: mainSize,
        reserve_size: reserveSize,
        min_rank_id: minRank,
        exclude_ids: excludeIds,
      },
      signal,
    }),
  /** Ссылка на PDF «Список сборной и проект приказа» по текущему черновику */
  orderDraftUrl: (
    target: SquadTarget,
    mainSize: number,
    reserveSize: number,
    minRank: number | undefined,
    excludeIds: string[],
    orderNumber: string,
    orderDate: string,
  ) => {
    const query = new URLSearchParams({
      discipline_id: String(target.discipline_id),
      group_kind: target.group_kind,
      group_id: String(target.group_id),
      main_size: String(mainSize),
      reserve_size: String(reserveSize),
    })
    if (minRank) query.set('min_rank_id', String(minRank))
    if (orderNumber) query.set('order_number', orderNumber)
    if (orderDate) query.set('order_date', orderDate)
    for (const id of excludeIds) query.append('exclude_ids', id)
    return `${env.apiUrl}/admin/squads/order-draft.pdf?${query}`
  },
  approve: (form: SquadForm) => request<SquadApproved>('/admin/squads', { method: 'POST', body: form }),
  dissolve: (id: number) => request<void>(`/admin/squads/${id}`, { method: 'DELETE' }),
}
