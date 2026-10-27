import { request } from '@/shared/api'
import type { AnyDictionaryItem, DictionaryInfo, DictionaryItemInput, DictionaryKey } from '../model/types'

/** Живой API справочников: публичное чтение и админка федерации */
export const httpDictionaryApi = {
  catalog: () => request<DictionaryInfo[]>('/dictionaries'),
  /** Публичный список для выбора в формах и фильтрах: без архива, вход не нужен */
  options: (key: DictionaryKey) => request<AnyDictionaryItem[]>(`/dictionaries/${key}`),
  list: (key: DictionaryKey, includeArchived: boolean) =>
    request<AnyDictionaryItem[]>(`/admin/dictionaries/${key}`, {
      query: { include_archived: includeArchived },
    }),
  create: (key: DictionaryKey, body: DictionaryItemInput) =>
    request<AnyDictionaryItem>(`/admin/dictionaries/${key}`, { method: 'POST', body }),
  update: (key: DictionaryKey, id: number, body: Partial<DictionaryItemInput>) =>
    request<AnyDictionaryItem>(`/admin/dictionaries/${key}/${id}`, { method: 'PATCH', body }),
  remove: (key: DictionaryKey, id: number) =>
    request<void>(`/admin/dictionaries/${key}/${id}`, { method: 'DELETE' }),
  archive: (key: DictionaryKey, id: number) =>
    request<AnyDictionaryItem>(`/admin/dictionaries/${key}/${id}/archive`, { method: 'POST' }),
  restore: (key: DictionaryKey, id: number) =>
    request<AnyDictionaryItem>(`/admin/dictionaries/${key}/${id}/restore`, { method: 'POST' }),
}

export type DictionaryApi = typeof httpDictionaryApi
