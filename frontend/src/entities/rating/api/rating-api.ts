import { request } from '@/shared/api'
import type {
  RatingBoard,
  RatingFilters,
  RatingRules,
  RatingRulesInput,
  RatingStanding,
  RatingStatus,
  RatingTableQuery,
} from '../model/types'

export const ratingApi = {
  boards: (filters: RatingFilters, limit: number, signal?: AbortSignal) =>
    request<{ items: RatingBoard[] }>('/ratings', { query: { ...filters, limit }, signal }),
  table: (query: RatingTableQuery, limit: number, offset: number, signal?: AbortSignal) =>
    request<RatingBoard>('/ratings/table', { query: { ...query, limit, offset }, signal }),
  athlete: (userId: string, signal?: AbortSignal) =>
    request<{ items: RatingStanding[] }>(`/ratings/athletes/${userId}`, { signal }),
  rules: (signal?: AbortSignal) => request<RatingRules>('/ratings/settings', { signal }),
  saveRules: (body: RatingRulesInput) =>
    request<RatingRules>('/admin/ratings/settings', { method: 'PUT', body }),
  me: (signal?: AbortSignal) => request<RatingStatus>('/ratings/me', { signal }),
}
