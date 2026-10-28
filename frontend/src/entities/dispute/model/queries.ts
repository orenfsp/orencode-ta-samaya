import { useQuery } from '@tanstack/react-query'
import { disputeApi } from '../api/dispute-api'

export const disputeKeys = {
  all: ['disputes'] as const,
  contest: (contestId: number) => ['disputes', 'contest', contestId] as const,
  mine: ['disputes', 'mine'] as const,
  appealable: ['disputes', 'appealable'] as const,
  queue: (includeClosed: boolean) => ['disputes', 'queue', includeClosed] as const,
}

export function useContestDisputes(contestId: number, enabled = true) {
  return useQuery({
    queryKey: disputeKeys.contest(contestId),
    queryFn: ({ signal }) => disputeApi.contest(contestId, signal),
    enabled,
    retry: false,
  })
}

export function useMyDisputes() {
  return useQuery({ queryKey: disputeKeys.mine, queryFn: ({ signal }) => disputeApi.mine(signal) })
}

/** Где можно подать апелляцию сейчас: соревнования со своими заявками или заявками подопечных */
export function useAppealable(enabled = true) {
  return useQuery({
    queryKey: disputeKeys.appealable,
    queryFn: ({ signal }) => disputeApi.appealable(signal),
    select: (page) => page.items,
    enabled,
  })
}

export function useDisputeQueue(includeClosed: boolean) {
  return useQuery({
    queryKey: disputeKeys.queue(includeClosed),
    queryFn: ({ signal }) => disputeApi.queue(includeClosed, signal),
  })
}
