import { request } from '@/shared/api'
import type { EvskCandidate, EvskRule, EvskRuleInput, PersonalPath } from '../model/types'

export const evskApi = {
  path: (signal?: AbortSignal) => request<PersonalPath>('/me/path', { signal }),
  candidates: (signal?: AbortSignal) => request<EvskCandidate[]>('/admin/evsk/candidates', { signal }),
  contest: (contestId: number, signal?: AbortSignal) =>
    request<EvskCandidate[]>(`/contests/${contestId}/evsk`, { signal }),
  rules: (signal?: AbortSignal) => request<EvskRule[]>('/admin/evsk/rules', { signal }),
  createRule: (input: EvskRuleInput) =>
    request<EvskRule>('/admin/evsk/rules', { method: 'POST', body: input }),
  updateRule: (id: number, input: EvskRuleInput) =>
    request<EvskRule>(`/admin/evsk/rules/${id}`, { method: 'PATCH', body: input }),
  removeRule: (id: number) => request<void>(`/admin/evsk/rules/${id}`, { method: 'DELETE' }),
}
