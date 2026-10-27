import { request, type Query } from '@/shared/api'
import type {
  Competition,
  CompetitionAction,
  CompetitionFilters,
  CompetitionInput,
  CompetitionScope,
  HistoryEntry,
  LevelPoints,
  ManagedCompetition,
  Page,
  RatingPoint,
} from '../model/types'

const base: Record<CompetitionScope, string> = {
  organizer: '/organizer/contests',
  admin: '/admin/contests',
}

const toQuery = (filters: CompetitionFilters, limit: number, offset: number): Query => ({
  ...filters,
  verified_only: filters.verified_only || undefined,
  has_prize_fund: filters.has_prize_fund || undefined,
  limit,
  offset,
})

export const competitionApi = {
  list: (filters: CompetitionFilters, limit: number, offset = 0, signal?: AbortSignal) =>
    request<Page<Competition>>('/contests', { query: toQuery(filters, limit, offset), signal }),
  detail: (id: number, signal?: AbortSignal) => request<Competition>(`/contests/${id}`, { signal }),

  managed: (scope: CompetitionScope, filters: CompetitionFilters, limit: number, offset = 0) =>
    request<Page<ManagedCompetition>>(base[scope], { query: toQuery(filters, limit, offset) }),
  create: (scope: CompetitionScope, body: CompetitionInput) =>
    request<ManagedCompetition>(base[scope], { method: 'POST', body }),
  update: (scope: CompetitionScope, id: number, body: Partial<CompetitionInput>) =>
    request<ManagedCompetition>(`${base[scope]}/${id}`, { method: 'PATCH', body }),
  remove: (scope: CompetitionScope, id: number) =>
    request<void>(`${base[scope]}/${id}`, { method: 'DELETE' }),
  transition: (scope: CompetitionScope, id: number, action: CompetitionAction) =>
    request<ManagedCompetition>(`${base[scope]}/${id}/${action}`, { method: 'POST' }),
  cancel: (scope: CompetitionScope, id: number, reason: string) =>
    request<ManagedCompetition>(`${base[scope]}/${id}/cancel`, { method: 'POST', body: { reason } }),

  requestVerification: (id: number) =>
    request<ManagedCompetition>(`/organizer/contests/${id}/request-verification`, { method: 'POST' }),
  verify: (id: number, rating_points: RatingPoint[]) =>
    request<ManagedCompetition>(`/admin/contests/${id}/verify`, {
      method: 'POST',
      body: { rating_points },
    }),
  setRatingPoints: (id: number, rating_points: RatingPoint[]) =>
    request<ManagedCompetition>(`/admin/contests/${id}/rating-points`, {
      method: 'PATCH',
      body: { rating_points },
    }),
  rejectVerification: (id: number, reason: string) =>
    request<ManagedCompetition>(`/admin/contests/${id}/reject-verification`, {
      method: 'POST',
      body: { reason },
    }),
  revokeVerification: (id: number) =>
    request<ManagedCompetition>(`/admin/contests/${id}/revoke-verification`, { method: 'POST' }),
  history: (id: number) => request<HistoryEntry[]>(`/admin/contests/${id}/history`),
  ratingDefaults: () => request<LevelPoints[]>('/admin/contests/rating-points-defaults'),
}
