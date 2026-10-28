import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../api/analytics-api'
import type { AnalyticsBlock, AnalyticsQuery } from './types'

export const analyticsKeys = {
  all: ['analytics'] as const,
  block: (block: AnalyticsBlock, query: AnalyticsQuery) => ['analytics', block, query] as const,
}

/** Блок аналитики. При смене фильтров прошлые цифры остаются на экране, пока не придут новые */
export function useAnalytics<B extends AnalyticsBlock>(block: B, query: AnalyticsQuery) {
  return useQuery({
    queryKey: analyticsKeys.block(block, query),
    queryFn: ({ signal }) => analyticsApi.block(block, query, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
