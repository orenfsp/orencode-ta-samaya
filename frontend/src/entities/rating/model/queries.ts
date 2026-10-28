import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ratingApi } from '../api/rating-api'
import type { RatingFilters, RatingTableQuery } from './types'

export const ratingKeys = {
  all: ['ratings'] as const,
  boards: (filters: RatingFilters, limit: number) => ['ratings', 'boards', filters, limit] as const,
  table: (query: RatingTableQuery, limit: number, offset: number) =>
    ['ratings', 'table', query, limit, offset] as const,
  athlete: (userId: string) => ['ratings', 'athlete', userId] as const,
  rules: ['ratings', 'rules'] as const,
  me: ['ratings', 'me'] as const,
}

export function useRatingBoards(filters: RatingFilters, limit: number) {
  return useQuery({
    queryKey: ratingKeys.boards(filters, limit),
    queryFn: ({ signal }) => ratingApi.boards(filters, limit, signal),
    select: (page) => page.items,
    placeholderData: keepPreviousData,
  })
}

export function useRatingTable(query: RatingTableQuery | null, limit: number, offset: number) {
  return useQuery({
    queryKey: ratingKeys.table(
      query ?? { discipline_id: '', group_kind: 'age', group_id: '' },
      limit,
      offset,
    ),
    queryFn: ({ signal }) => ratingApi.table(query!, limit, offset, signal),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  })
}

export function useAthleteRatings(userId: string | undefined) {
  return useQuery({
    queryKey: ratingKeys.athlete(userId ?? ''),
    queryFn: ({ signal }) => ratingApi.athlete(userId!, signal),
    select: (page) => page.items,
    enabled: Boolean(userId),
  })
}

export function useRatingRules() {
  return useQuery({
    queryKey: ratingKeys.rules,
    queryFn: ({ signal }) => ratingApi.rules(signal),
    staleTime: 5 * 60_000,
  })
}

export function useMyRatingStatus(enabled = true) {
  return useQuery({
    queryKey: ratingKeys.me,
    queryFn: ({ signal }) => ratingApi.me(signal),
    enabled,
  })
}
