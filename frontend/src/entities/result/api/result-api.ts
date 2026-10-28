import { fileUrl, request } from '@/shared/api'
import type { ContestResults, ImportPreview, PlaceInput, ResultsForm, ResultsScope } from '../model/types'

export const resultApi = {
  contest: (contestId: number, signal?: AbortSignal) =>
    request<ContestResults>(`/contests/${contestId}/results`, { signal }),
  form: (scope: ResultsScope, contestId: number, signal?: AbortSignal) =>
    request<ResultsForm>(`/${scope}/contests/${contestId}/results`, { signal }),
  /** source — имя файла протокола: попадает в журнал действий */
  save: (scope: ResultsScope, contestId: number, items: PlaceInput[], source?: string) =>
    request<ResultsForm>(`/${scope}/contests/${contestId}/results`, {
      method: 'PUT',
      body: { items, source },
    }),
  /** Протокол xlsx или PDF: сопоставление строк с заявками, ничего не сохраняет */
  importPreview: (scope: ResultsScope, contestId: number, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<ImportPreview>(`/${scope}/contests/${contestId}/results/import`, { method: 'POST', body })
  },
  /** Обычная ссылка: файл отдаётся по cookie-сессии, CSRF для GET не нужен */
  protocolUrl: (scope: ResultsScope, contestId: number) =>
    fileUrl(`/${scope}/contests/${contestId}/results/protocol.xlsx`),
}
