import { useQuery } from '@tanstack/react-query'
import { judgeDocumentApi } from '../api/judge-document-api'

export const judgeDocumentKeys = {
  contest: (contestId: number) => ['judge-documents', contestId] as const,
}

export function useJudgeDocuments(contestId: number, enabled = true) {
  return useQuery({
    queryKey: judgeDocumentKeys.contest(contestId),
    queryFn: ({ signal }) => judgeDocumentApi.list(contestId, signal),
    enabled: enabled && contestId > 0,
  })
}
