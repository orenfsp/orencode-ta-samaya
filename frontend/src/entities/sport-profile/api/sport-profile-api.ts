import { request } from '@/shared/api'
import type {
  CoachLink,
  CoachLinkAction,
  LinkCandidate,
  SportProfile,
  SportProfileInput,
} from '../model/types'

export const sportProfileApi = {
  get: (signal?: AbortSignal) => request<SportProfile>('/me/sport-profile', { signal }),
  save: (input: SportProfileInput) =>
    request<SportProfile>('/me/sport-profile', { method: 'PUT', body: input }),
  addAntidoping: (input: { passed_on: string; certificate_url?: string; file_id?: string }) =>
    request<SportProfile>('/me/antidoping', { method: 'POST', body: input }),
  removeAntidoping: (id: string) => request<SportProfile>(`/me/antidoping/${id}`, { method: 'DELETE' }),
  links: (signal?: AbortSignal) =>
    request<{ as_coach: CoachLink[]; as_athlete: CoachLink[] }>('/me/coach-links', { signal }),
  candidates: (q: string, signal?: AbortSignal) =>
    request<LinkCandidate[]>('/coach-links/candidates', { query: { q: q.trim() || undefined }, signal }),
  requestLink: (input: { athlete_id: string; discipline_id: number; comment?: string }) =>
    request<CoachLink>('/coach-links', { method: 'POST', body: input }),
  move: (id: string, action: CoachLinkAction, comment?: string) =>
    request<CoachLink>(`/coach-links/${id}/${action}`, { method: 'POST', body: { comment } }),
}
