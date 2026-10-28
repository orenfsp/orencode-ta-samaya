import { request } from '@/shared/api'
import type { JudgeDocument, JudgeDocumentInput } from '../model/types'

export const judgeDocumentApi = {
  list: (contestId: number, signal?: AbortSignal) =>
    request<JudgeDocument[]>(`/contests/${contestId}/judge-documents`, { signal }),
  upload: (contestId: number, input: Required<Pick<JudgeDocumentInput, 'file_id'>> & JudgeDocumentInput) =>
    request<JudgeDocument>(`/contests/${contestId}/judge-documents`, { method: 'POST', body: input }),
  replace: (id: string, input: JudgeDocumentInput) =>
    request<JudgeDocument>(`/judge-documents/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<void>(`/judge-documents/${id}`, { method: 'DELETE' }),
}
