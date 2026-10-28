import { useQuery } from '@tanstack/react-query'
import { fileUrl, request } from '@/shared/api'

export interface ReportAccess {
  allowed: boolean
  date_from: string
  date_to: string
}

export const reportApi = {
  access: (userId: string, signal?: AbortSignal) =>
    request<ReportAccess>(`/people/${userId}/report`, { signal }),
  url: (userId: string, format: 'pdf' | 'xlsx', from: string, to: string) =>
    fileUrl(`/people/${userId}/report.${format}`, { from, to }),
}

/** Сервер сам решает, можно ли: сам человек, федерация, тренер с одобренной заявкой */
export function useReportAccess(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['people', userId, 'report-access'],
    queryFn: ({ signal }) => reportApi.access(userId, signal),
    enabled,
    retry: false,
  })
}
