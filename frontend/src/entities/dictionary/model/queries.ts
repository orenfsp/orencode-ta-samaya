import { useQuery } from '@tanstack/react-query'
import { dictionaryApi } from '../api'
import type { DictionaryKey } from './types'

export const dictionaryKeys = {
  all: ['dictionaries'] as const,
  catalog: ['dictionaries', 'catalog'] as const,
  list: (key: DictionaryKey) => ['dictionaries', 'list', key] as const,
  options: (key: DictionaryKey) => ['dictionaries', 'options', key] as const,
}

/** Набор справочников меняется только кодом — кешируем надолго */
export function useDictionaryCatalog() {
  return useQuery({ queryKey: dictionaryKeys.catalog, queryFn: dictionaryApi.catalog, staleTime: Infinity })
}

/** Все записи справочника вместе с архивом: показ архива — фильтр на клиенте, без лишнего запроса */
export function useDictionaryItems(key: DictionaryKey) {
  return useQuery({ queryKey: dictionaryKeys.list(key), queryFn: () => dictionaryApi.list(key, true) })
}

/** Значения для выбора в формах и фильтрах: публичный список без архива */
export function useDictionaryOptions(key: DictionaryKey) {
  return useQuery({
    queryKey: dictionaryKeys.options(key),
    queryFn: () => dictionaryApi.options(key),
    staleTime: 300_000,
  })
}
