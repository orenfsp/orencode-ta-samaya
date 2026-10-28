import { useQuery } from '@tanstack/react-query'
import { deadlineApi } from '../api/deadline-api'

export const deadlineKeys = {
  mine: ['deadlines', 'mine'] as const,
  reports: (includeDone: boolean) => ['deadlines', 'reports', includeDone] as const,
  readiness: (contestId: number) => ['deadlines', 'readiness', contestId] as const,
}

export function useMyDeadlines() {
  return useQuery({ queryKey: deadlineKeys.mine, queryFn: ({ signal }) => deadlineApi.mine(signal) })
}

export function useReportDeadlines(includeDone: boolean, enabled = true) {
  return useQuery({
    queryKey: deadlineKeys.reports(includeDone),
    queryFn: ({ signal }) => deadlineApi.reports(includeDone, signal),
    enabled,
  })
}

export function useReadiness(contestId: number, enabled: boolean) {
  return useQuery({
    queryKey: deadlineKeys.readiness(contestId),
    queryFn: ({ signal }) => deadlineApi.readiness(contestId, signal),
    enabled,
  })
}
