import { request } from '@/shared/api'
import type { Deadline, Readiness, ReportDeadline, ReportDeadlineInput } from '../model/types'

export const deadlineApi = {
  mine: (signal?: AbortSignal) => request<Deadline[]>('/me/deadlines', { signal }),
  reports: (includeDone: boolean, signal?: AbortSignal) =>
    request<ReportDeadline[]>('/admin/report-deadlines', { query: { include_done: includeDone }, signal }),
  createReport: (input: ReportDeadlineInput) =>
    request<ReportDeadline>('/admin/report-deadlines', { method: 'POST', body: input }),
  updateReport: (id: number, input: ReportDeadlineInput) =>
    request<ReportDeadline>(`/admin/report-deadlines/${id}`, { method: 'PATCH', body: input }),
  removeReport: (id: number) => request<void>(`/admin/report-deadlines/${id}`, { method: 'DELETE' }),
  readiness: (contestId: number, signal?: AbortSignal) =>
    request<Readiness>(`/contests/${contestId}/readiness`, { signal }),
}
