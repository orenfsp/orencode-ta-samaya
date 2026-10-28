import { useQuery } from '@tanstack/react-query'
import { sportProfileApi } from '../api/sport-profile-api'

export const sportProfileKeys = {
  profile: ['sport-profile'] as const,
  links: ['coach-links'] as const,
  candidates: (q: string) => ['coach-links', 'candidates', q] as const,
}

export function useSportProfile(enabled = true) {
  return useQuery({
    queryKey: sportProfileKeys.profile,
    queryFn: ({ signal }) => sportProfileApi.get(signal),
    enabled,
  })
}

export function useCoachLinks() {
  return useQuery({
    queryKey: sportProfileKeys.links,
    queryFn: ({ signal }) => sportProfileApi.links(signal),
  })
}

export function useLinkCandidates(q: string, enabled: boolean) {
  return useQuery({
    queryKey: sportProfileKeys.candidates(q),
    queryFn: ({ signal }) => sportProfileApi.candidates(q, signal),
    enabled,
  })
}
