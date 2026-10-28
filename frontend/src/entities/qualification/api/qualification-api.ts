import { fileUrl, request } from '@/shared/api'
import type {
  JudgeCandidate,
  JudgePanel,
  MyJudgeAssignment,
  MyQualifications,
  Qualification,
  QualificationInput,
  QualificationKind,
  QualificationPerson,
  QualificationStatus,
  ResultChoice,
  VerifiedQualification,
} from '../model/types'

export const qualificationApi = {
  mine: (signal?: AbortSignal) => request<MyQualifications>('/me/qualifications', { signal }),
  athletes: (signal?: AbortSignal) => request<QualificationPerson[]>('/me/athletes', { signal }),
  submit: (input: QualificationInput) =>
    request<Qualification>('/qualifications', { method: 'POST', body: input }),
  withdraw: (id: string) => request<Qualification>(`/qualifications/${id}/withdraw`, { method: 'POST' }),
  queue: (kind: QualificationKind | undefined, status: QualificationStatus | 'all', signal?: AbortSignal) =>
    request<Qualification[]>('/admin/qualifications', {
      signal,
      query: { kind, status: status === 'all' ? undefined : status },
    }),
  preview: (id: string) => request<{ valid_until: string | null }>(`/admin/qualifications/${id}/preview`),
  approve: (id: string, order: { order_number: string; order_date: string }) =>
    request<Qualification>(`/admin/qualifications/${id}/approve`, { method: 'POST', body: order }),
  results: (userId?: string, signal?: AbortSignal) =>
    request<ResultChoice[]>('/me/qualification-results', { query: { user_id: userId }, signal }),
  verify: (token: string, signal?: AbortSignal) =>
    request<VerifiedQualification>(`/verify/qualifications/${encodeURIComponent(token)}`, { signal }),
  reject: (id: string, reason: string) =>
    request<Qualification>(`/admin/qualifications/${id}/reject`, { method: 'POST', body: { reason } }),
  documentUrl: (fileId: string) => fileUrl(`/files/${fileId}`),
  panel: (contestId: number, signal?: AbortSignal) =>
    request<JudgePanel>(`/contests/${contestId}/judges`, { signal }),
  candidates: (contestId: number, q: string, signal?: AbortSignal) =>
    request<JudgeCandidate[]>(`/contests/${contestId}/judges/candidates`, {
      signal,
      query: { q: q.trim() || undefined },
    }),
  assign: (contestId: number, judgeId: string, positionId: number) =>
    request<JudgePanel>(`/contests/${contestId}/judges`, {
      method: 'POST',
      body: { judge_id: judgeId, position_id: positionId },
    }),
  move: (contestId: number, assignmentId: string, positionId: number) =>
    request<JudgePanel>(`/contests/${contestId}/judges/${assignmentId}`, {
      method: 'PATCH',
      body: { position_id: positionId },
    }),
  remove: (contestId: number, assignmentId: string) =>
    request<JudgePanel>(`/contests/${contestId}/judges/${assignmentId}`, { method: 'DELETE' }),
  myAssignments: (signal?: AbortSignal) => request<MyJudgeAssignment[]>('/me/judge-assignments', { signal }),
}
