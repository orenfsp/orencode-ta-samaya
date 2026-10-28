import { useQuery } from '@tanstack/react-query'
import { resultApi } from '../api/result-api'
import type { ResultsScope } from './types'

export const resultKeys = {
  all: ['results'] as const,
  contest: (contestId: number) => ['results', 'contest', contestId] as const,
  form: (scope: ResultsScope, contestId: number) => ['results', scope, contestId] as const,
}

export function useContestResults(contestId: number) {
  return useQuery({
    queryKey: resultKeys.contest(contestId),
    queryFn: ({ signal }) => resultApi.contest(contestId, signal),
    enabled: contestId > 0,
  })
}

/** Все одобренные заявки с текущими местами: грузится, только пока открыто окно */
export function useResultsForm(scope: ResultsScope, contestId: number, enabled: boolean) {
  return useQuery({
    queryKey: resultKeys.form(scope, contestId),
    queryFn: ({ signal }) => resultApi.form(scope, contestId, signal),
    enabled,
  })
}
