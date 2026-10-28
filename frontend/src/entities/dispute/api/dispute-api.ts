import { request } from '@/shared/api'
import type {
  Appealable,
  Appeal,
  AppealDecision,
  AppealInput,
  ContestDisputes,
  DisputeList,
  Violation,
  ViolationDecision,
  ViolationInput,
} from '../model/types'

export const disputeApi = {
  contest: (contestId: number, signal?: AbortSignal) =>
    request<ContestDisputes>(`/contests/${contestId}/disputes`, { signal }),
  mine: (signal?: AbortSignal) => request<DisputeList>('/me/disputes', { signal }),
  appealable: (signal?: AbortSignal) => request<{ items: Appealable[] }>('/me/appealable', { signal }),
  queue: (includeClosed: boolean, signal?: AbortSignal) =>
    request<DisputeList>('/admin/disputes', { query: { include_closed: includeClosed }, signal }),
  fileAppeal: (contestId: number, body: AppealInput) =>
    request<Appeal>(`/contests/${contestId}/appeals`, { method: 'POST', body }),
  withdraw: (id: string) => request<Appeal>(`/appeals/${id}/withdraw`, { method: 'POST' }),
  report: (contestId: number, body: ViolationInput) =>
    request<Violation>(`/contests/${contestId}/violations`, { method: 'POST', body }),
  review: (id: string) => request<Appeal>(`/admin/appeals/${id}/review`, { method: 'POST' }),
  decideAppeal: (id: string, body: AppealDecision) =>
    request<Appeal>(`/admin/appeals/${id}/decide`, { method: 'POST', body }),
  decideViolation: (id: string, body: ViolationDecision) =>
    request<Violation>(`/admin/violations/${id}/decide`, { method: 'POST', body }),
}
