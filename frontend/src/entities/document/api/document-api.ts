import { fileUrl, request, requestBlob } from '@/shared/api'
import type {
  DocumentForm,
  DocumentGroup,
  DocumentKind,
  DocumentScope,
  MyDocument,
  MyDocuments,
  VerifiedDocument,
} from '../model/types'

const body = (form: DocumentForm) => ({
  ...form,
  lead: form.lead.trim() || null,
  text: form.text.trim() || null,
  signer_position: form.signer_position.trim() || null,
  signer_name: form.signer_name.trim() || null,
})

export const documentApi = {
  contest: (contestId: number, signal?: AbortSignal) =>
    request<{ items: DocumentGroup[] }>(`/contests/${contestId}/documents`, { signal }),
  verify: (token: string, signal?: AbortSignal) =>
    request<VerifiedDocument>(`/documents/${encodeURIComponent(token)}`, { signal }),
  /** Выпуск заменяет все прежние документы этого вида по соревнованию */
  issue: (scope: DocumentScope, contestId: number, kind: DocumentKind, form: DocumentForm) =>
    request<{ items: DocumentGroup[] }>(`/${scope}/contests/${contestId}/documents/${kind}`, {
      method: 'PUT',
      body: body(form),
    }),
  remove: (scope: DocumentScope, contestId: number, kind: DocumentKind) =>
    request<void>(`/${scope}/contests/${contestId}/documents/${kind}`, { method: 'DELETE' }),
  preview: (scope: DocumentScope, contestId: number, kind: DocumentKind, form: DocumentForm) =>
    requestBlob(`/${scope}/contests/${contestId}/documents/${kind}/preview`, body(form)),
  mine: (query: { sort?: 'new' | 'old'; kind?: DocumentKind }, signal?: AbortSignal) =>
    request<MyDocuments>('/me/documents', { query, signal }),
  requestReference: (contestId: number) =>
    request<MyDocument[]>('/me/documents/reference', { method: 'POST', body: { contest_id: contestId } }),
  pdfUrl: (token: string) => fileUrl(`/documents/${encodeURIComponent(token)}/pdf`),
  kindPdfUrl: (contestId: number, kind: DocumentKind) =>
    fileUrl(`/contests/${contestId}/documents/${kind}/pdf`),
}
