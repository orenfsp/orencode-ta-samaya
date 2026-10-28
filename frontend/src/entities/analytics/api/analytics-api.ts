import { fileUrl, request } from '@/shared/api'
import type { AnalyticsBlock, AnalyticsData, AnalyticsQuery } from '../model/types'

export const analyticsApi = {
  block: <B extends AnalyticsBlock>(block: B, query: AnalyticsQuery, signal?: AbortSignal) =>
    request<AnalyticsData[B]>(`/admin/analytics/${block}`, { query: { ...query }, signal }),
  /** Ссылка на xlsx: один блок листом или вся аналитика книгой. Сессия уходит cookie */
  xlsxUrl: (query: AnalyticsQuery, block?: AnalyticsBlock) =>
    fileUrl(block ? `/admin/analytics/${block}.xlsx` : '/admin/analytics.xlsx', { ...query }),
}
