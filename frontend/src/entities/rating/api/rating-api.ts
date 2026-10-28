import { request } from '@/shared/api'
import type { RatingBoard, RatingFilters, RatingStanding, RatingTableQuery } from '../model/types'

export const ratingApi = {
  boards: (filters: RatingFilters, limit: number, signal?: AbortSignal) =>
    request<{ items: RatingBoard[] }>('/ratings', { query: { ...filters, limit }, signal }),
  table: (query: RatingTableQuery, limit: number, offset: number, signal?: AbortSignal) =>
    request<RatingBoard>('/ratings/table', { query: { ...query, limit, offset }, signal }),
  athlete: (userId: string, signal?: AbortSignal) =>
    request<{ items: RatingStanding[] }>(`/ratings/athletes/${userId}`, { signal }),
}
