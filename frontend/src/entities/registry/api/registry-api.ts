import { fileUrl, request } from '@/shared/api'
import type {
  Headcount,
  HeadcountCut,
  Page,
  RegistryAthlete,
  RegistryCoach,
  RegistryJudge,
  RegistryQuery,
} from '../model/types'

export const registryApi = {
  athletes: (query: RegistryQuery, signal?: AbortSignal) =>
    request<Page<RegistryAthlete>>('/admin/registry/athletes', { query, signal }),
  coaches: (query: RegistryQuery, signal?: AbortSignal) =>
    request<Page<RegistryCoach>>('/admin/registry/coaches', { query, signal }),
  judges: (query: RegistryQuery, signal?: AbortSignal) =>
    request<Page<RegistryJudge>>('/admin/registry/judges', { query, signal }),
  headcount: (cut: HeadcountCut, from: number, to: number, signal?: AbortSignal) =>
    request<Headcount>('/admin/registry/headcount', { query: { cut, from, to }, signal }),
  xlsx: (kind: 'athletes' | 'coaches' | 'judges', query: RegistryQuery) =>
    fileUrl(`/admin/registry/${kind}.xlsx`, { ...query, limit: undefined, offset: undefined }),
  headcountXlsx: (from: number, to: number) => fileUrl('/admin/registry/headcount.xlsx', { from, to }),
}
