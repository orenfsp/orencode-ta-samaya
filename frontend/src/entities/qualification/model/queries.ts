import { useQuery } from '@tanstack/react-query'
import { qualificationApi } from '../api/qualification-api'
import type { QualificationKind, QualificationStatus } from './types'

export const qualificationKeys = {
  all: ['qualifications'] as const,
  mine: ['qualifications', 'mine'] as const,
  athletes: ['qualifications', 'athletes'] as const,
  queue: (kind: QualificationKind | undefined, status: QualificationStatus | 'all') =>
    ['qualifications', 'queue', kind ?? 'all', status] as const,
  judges: ['judges'] as const,
  panel: (contestId: number) => ['judges', 'panel', contestId] as const,
  candidates: (contestId: number, q: string) => ['judges', 'candidates', contestId, q] as const,
  myAssignments: ['judges', 'mine'] as const,
}

export function useMyQualifications() {
  return useQuery({
    queryKey: qualificationKeys.mine,
    queryFn: ({ signal }) => qualificationApi.mine(signal),
  })
}

export function useCoachAthletes(enabled = true) {
  return useQuery({
    queryKey: qualificationKeys.athletes,
    queryFn: ({ signal }) => qualificationApi.athletes(signal),
    enabled,
  })
}

export function useQualificationQueue(
  kind: QualificationKind | undefined,
  status: QualificationStatus | 'all',
) {
  return useQuery({
    queryKey: qualificationKeys.queue(kind, status),
    queryFn: ({ signal }) => qualificationApi.queue(kind, status, signal),
  })
}

export function useJudgePanel(contestId: number, enabled = true) {
  return useQuery({
    queryKey: qualificationKeys.panel(contestId),
    queryFn: ({ signal }) => qualificationApi.panel(contestId, signal),
    enabled: enabled && contestId > 0,
  })
}

export function useJudgeCandidates(contestId: number, q: string, enabled = true) {
  return useQuery({
    queryKey: qualificationKeys.candidates(contestId, q),
    queryFn: ({ signal }) => qualificationApi.candidates(contestId, q, signal),
    enabled: enabled && contestId > 0,
  })
}

export function useMyJudgeAssignments() {
  return useQuery({
    queryKey: qualificationKeys.myAssignments,
    queryFn: ({ signal }) => qualificationApi.myAssignments(signal),
  })
}
