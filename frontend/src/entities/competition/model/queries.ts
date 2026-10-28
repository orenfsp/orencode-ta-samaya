import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { flatPages, offsetPaging } from '@/shared/api'
import { competitionApi } from '../api/competition-api'
import type { CompetitionFilters, CompetitionScope } from './types'

export const competitionKeys = {
  all: ['competitions'] as const,
  public: (filters: CompetitionFilters, step: number) => ['competitions', 'public', filters, step] as const,
  detail: (id: number) => ['competitions', 'detail', id] as const,
  managed: (scope: CompetitionScope, filters: CompetitionFilters, step: number) =>
    ['competitions', scope, filters, step] as const,
  ratingDefaults: ['competitions', 'rating-defaults'] as const,
}

/** Каталог: «Показать ещё» догружает следующую страницу по offset, при смене фильтров прежний список остаётся на экране */
export function useCompetitions(filters: CompetitionFilters, step: number) {
  return useInfiniteQuery({
    queryKey: competitionKeys.public(filters, step),
    queryFn: ({ pageParam, signal }) => competitionApi.list(filters, step, pageParam, signal),
    ...offsetPaging,
    select: flatPages,
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

/** Соревнования организатора или федерации: страницы по offset, как в каталоге */
export function useManagedCompetitions(scope: CompetitionScope, filters: CompetitionFilters, step: number) {
  return useInfiniteQuery({
    queryKey: competitionKeys.managed(scope, filters, step),
    queryFn: ({ pageParam }) => competitionApi.managed(scope, filters, step, pageParam),
    ...offsetPaging,
    select: flatPages,
    placeholderData: keepPreviousData,
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
