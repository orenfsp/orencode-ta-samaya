import { fileUrl, request } from '@/shared/api'
import type { ContestResults, PlaceInput, ResultsForm, ResultsScope } from '../model/types'

export const resultApi = {
  contest: (contestId: number, signal?: AbortSignal) =>
    request<ContestResults>(`/contests/${contestId}/results`, { signal }),
  form: (scope: ResultsScope, contestId: number, signal?: AbortSignal) =>
    request<ResultsForm>(`/${scope}/contests/${contestId}/results`, { signal }),
  save: (scope: ResultsScope, contestId: number, items: PlaceInput[]) =>
    request<ResultsForm>(`/${scope}/contests/${contestId}/results`, { method: 'PUT', body: { items } }),
  /** Обычная ссылка: файл отдаётся по cookie-сессии, CSRF для GET не нужен */
  protocolUrl: (scope: ResultsScope, contestId: number) =>
    fileUrl(`/${scope}/contests/${contestId}/results/protocol.xlsx`),
}
