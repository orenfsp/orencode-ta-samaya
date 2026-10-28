import { useQuery } from '@tanstack/react-query'
import { evskApi } from '../api/evsk-api'

export const evskKeys = {
  all: ['evsk'] as const,
  path: ['evsk', 'path'] as const,
  candidates: ['evsk', 'candidates'] as const,
  contest: (contestId: number) => ['evsk', 'contest', contestId] as const,
  rules: ['evsk', 'rules'] as const,
}

export function usePersonalPath(enabled = true) {
  return useQuery({ queryKey: evskKeys.path, queryFn: ({ signal }) => evskApi.path(signal), enabled })
}

export function useEvskCandidates(enabled = true) {
  return useQuery({
    queryKey: evskKeys.candidates,
    queryFn: ({ signal }) => evskApi.candidates(signal),
    enabled,
  })
}

export function useContestEvsk(contestId: number, enabled = true) {
  return useQuery({
    queryKey: evskKeys.contest(contestId),
    queryFn: ({ signal }) => evskApi.contest(contestId, signal),
    enabled,
    retry: false,
  })
}

export function useEvskRules(enabled = true) {
  return useQuery({ queryKey: evskKeys.rules, queryFn: ({ signal }) => evskApi.rules(signal), enabled })
}
