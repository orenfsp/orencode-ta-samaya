import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { competitionApi } from '../api/competition-api'
import type { CompetitionFilters, CompetitionScope } from './types'

export const competitionKeys = {
  all: ['competitions'] as const,
  public: (filters: CompetitionFilters, limit: number) => ['competitions', 'public', filters, limit] as const,
  detail: (id: number) => ['competitions', 'detail', id] as const,
  managed: (scope: CompetitionScope, filters: CompetitionFilters, limit: number) =>
    ['competitions', scope, filters, limit] as const,
  history: (id: number) => ['competitions', 'history', id] as const,
  ratingDefaults: ['competitions', 'rating-defaults'] as const,
}

/** Каталог: «Показать ещё» увеличивает limit, прежняя страница остаётся на экране, пока грузится новая */
export function useCompetitions(filters: CompetitionFilters, limit: number) {
  return useQuery({
    queryKey: competitionKeys.public(filters, limit),
    queryFn: ({ signal }) => competitionApi.list(filters, limit, 0, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useCompetition(id: number) {
  return useQuery({
    queryKey: competitionKeys.detail(id),
    queryFn: ({ signal }) => competitionApi.detail(id, signal),
    enabled: Number.isInteger(id) && id > 0,
  })
}

export function useManagedCompetitions(scope: CompetitionScope, filters: CompetitionFilters, limit: number) {
  return useQuery({
    queryKey: competitionKeys.managed(scope, filters, limit),
    queryFn: () => competitionApi.managed(scope, filters, limit),
    placeholderData: keepPreviousData,
  })
}

export function useCompetitionHistory(id: number, enabled: boolean) {
  return useQuery({
    queryKey: competitionKeys.history(id),
    queryFn: () => competitionApi.history(id),
    enabled,
  })
}

/** Баллы по умолчанию по уровням меняются только кодом — кешируем надолго */
export function useRatingDefaults(enabled = true) {
  return useQuery({
    queryKey: competitionKeys.ratingDefaults,
    queryFn: competitionApi.ratingDefaults,
    staleTime: Infinity,
    enabled,
  })
}
