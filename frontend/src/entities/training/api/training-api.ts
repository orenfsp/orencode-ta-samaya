import { request } from '@/shared/api'
import type {
  Attendance,
  Attestation,
  Board,
  DecisionInput,
  Enrollment,
  GroupDetail,
  GroupInput,
  GroupQuery,
  MoveInput,
  Norm,
  NormHistory,
  NormInput,
  NormResult,
  OrganizationCard,
  SessionInput,
  TrainingGroup,
  TrainingSession,
  TrainingStage,
} from '../model/types'

export const trainingApi = {
  card: (id: number, admin: boolean, signal?: AbortSignal) =>
    request<OrganizationCard>(admin ? `/admin/organizations/${id}` : `/organizations/${id}`, { signal }),
  addProgram: (id: number, input: { discipline_id: number; stage: TrainingStage }) =>
    request<OrganizationCard>(`/admin/organizations/${id}/programs`, { method: 'POST', body: input }),
  closeProgram: (id: number, programId: number) =>
    request<OrganizationCard>(`/admin/organizations/${id}/programs/${programId}`, { method: 'DELETE' }),
  addCoach: (id: number, input: { coach_id: string; position: string }) =>
    request<OrganizationCard>(`/admin/organizations/${id}/coaches`, { method: 'POST', body: input }),
  closeCoach: (id: number, recordId: number) =>
    request<OrganizationCard>(`/admin/organizations/${id}/coaches/${recordId}`, { method: 'DELETE' }),

  groups: (query: GroupQuery, signal?: AbortSignal) =>
    request<TrainingGroup[]>('/training/groups', { query: { ...query }, signal }),
  group: (id: number, signal?: AbortSignal) => request<GroupDetail>(`/training/groups/${id}`, { signal }),
  createGroup: (input: GroupInput) =>
    request<TrainingGroup>('/training/groups', { method: 'POST', body: input }),
  updateGroup: (id: number, input: GroupInput) =>
    request<TrainingGroup>(`/training/groups/${id}`, { method: 'PATCH', body: input }),
  enroll: (groupId: number, input: MoveInput & { athlete_id: string }) =>
    request<Enrollment>(`/training/groups/${groupId}/enrollments`, { method: 'POST', body: input }),
  transfer: (id: string, input: MoveInput & { target_group_id: number }) =>
    request<Enrollment>(`/training/enrollments/${id}/transfer`, { method: 'POST', body: input }),
  expel: (id: string, input: MoveInput) =>
    request<Enrollment>(`/training/enrollments/${id}/expel`, { method: 'POST', body: input }),
  enrollments: (athleteId: string, signal?: AbortSignal) =>
    request<Enrollment[]>(`/training/athletes/${athleteId}/enrollments`, { signal }),

  sessions: (groupId: number, signal?: AbortSignal) =>
    request<{ group: TrainingGroup; sessions: TrainingSession[] }>(`/training/groups/${groupId}/sessions`, {
      signal,
    }),
  createSession: (groupId: number, input: SessionInput) =>
    request<TrainingSession>(`/training/groups/${groupId}/sessions`, { method: 'POST', body: input }),
  updateSession: (id: string, input: SessionInput) =>
    request<TrainingSession>(`/training/sessions/${id}`, { method: 'PUT', body: input }),
  removeSession: (id: string) => request<void>(`/training/sessions/${id}`, { method: 'DELETE' }),
  attendance: (athleteId: string, signal?: AbortSignal) =>
    request<Attendance>(`/training/athletes/${athleteId}/attendance`, { signal }),

  norms: (admin: boolean, stage?: TrainingStage, signal?: AbortSignal) =>
    request<Norm[]>(admin ? '/admin/norms' : '/norms', { query: { stage }, signal }),
  createNorm: (input: NormInput) => request<Norm>('/admin/norms', { method: 'POST', body: input }),
  updateNorm: (id: number, input: NormInput) =>
    request<Norm>(`/admin/norms/${id}`, { method: 'PATCH', body: input }),
  record: (items: { athlete_id: string; norm_id: number; value: number; passed_on: string }[]) =>
    request<NormResult[]>('/training/norm-results', { method: 'POST', body: { items } }),
  history: (athleteId: string, signal?: AbortSignal) =>
    request<NormHistory>(`/training/athletes/${athleteId}/norms`, { signal }),

  board: (groupId: number, signal?: AbortSignal) =>
    request<Board>(`/training/groups/${groupId}/attestation`, { signal }),
  decide: (input: DecisionInput) =>
    request<Attestation>('/training/attestations', { method: 'POST', body: input }),
}
