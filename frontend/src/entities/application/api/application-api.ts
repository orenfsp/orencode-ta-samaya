import { request } from '@/shared/api'
import type {
  Application,
  ApplicationInput,
  ApplicationRole,
  ApplicationStatus,
  AthleteFound,
  AvailableContest,
  ContestWithApplications,
  ModeratedApplication,
  ModerationScope,
} from '../model/types'

export const applicationApi = {
  mine: (as: ApplicationRole, signal?: AbortSignal) =>
    request<{ items: Application[] }>('/me/applications', { query: { as }, signal }),
  available: (as: ApplicationRole, signal?: AbortSignal) =>
    request<{ items: AvailableContest[] }>('/me/available-contests', { query: { as }, signal }),
  searchAthletes: (q: string, contestId: number | null, signal?: AbortSignal) =>
    request<{ items: AthleteFound[] }>('/athletes/search', {
      query: { q, contest_id: contestId ?? undefined },
      signal,
    }),
  create: (contestId: number, body: ApplicationInput) =>
    request<Application>(`/contests/${contestId}/applications`, { method: 'POST', body }),
  /** Тренер: по личной заявке на каждого выбранного спортсмена, всё или ничего */
  createForAthletes: (contestId: number, memberIds: string[]) =>
    request<{ items: Application[] }>(`/contests/${contestId}/applications/batch`, {
      method: 'POST',
      body: { member_ids: memberIds },
    }),
  rename: (id: number, team_name: string) =>
    request<Application>(`/applications/${id}`, { method: 'PATCH', body: { team_name } }),
  addMember: (id: number, user_id: string) =>
    request<Application>(`/applications/${id}/members`, { method: 'POST', body: { user_id } }),
  removeMember: (id: number, userId: string) =>
    request<Application>(`/applications/${id}/members/${userId}`, { method: 'DELETE' }),
  act: (id: number, action: 'submit' | 'withdraw' | 'confirm' | 'decline') =>
    request<Application>(`/applications/${id}/${action}`, { method: 'POST' }),

  contests: (scope: ModerationScope, signal?: AbortSignal) =>
    request<{ items: ContestWithApplications[]; total: number }>(`/${scope}/applications/contests`, {
      query: { limit: 200 },
      signal,
    }),
  moderated: (
    scope: ModerationScope,
    contestId: number,
    filters: { status?: ApplicationStatus; search?: string },
    limit: number,
    signal?: AbortSignal,
  ) =>
    request<{ items: ModeratedApplication[]; total: number }>(
      `/${scope}/contests/${contestId}/applications`,
      {
        query: { ...filters, limit },
        signal,
      },
    ),
  approve: (scope: ModerationScope, ids: number[]) =>
    request<{ items: ModeratedApplication[] }>(`/${scope}/applications/approve`, {
      method: 'POST',
      body: { ids },
    }),
  reject: (scope: ModerationScope, ids: number[], reason: string) =>
    request<{ items: ModeratedApplication[] }>(`/${scope}/applications/reject`, {
      method: 'POST',
      body: { ids, reason },
    }),
  reset: (scope: ModerationScope, id: number) =>
    request<ModeratedApplication>(`/${scope}/applications/${id}/reset`, { method: 'POST' }),
}
