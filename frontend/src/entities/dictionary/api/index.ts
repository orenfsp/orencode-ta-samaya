import { httpDictionaryApi } from './http-api'
import { mockDictionaryApi } from './mock-api'

/**
 * Живой API справочников. VITE_DICTIONARIES_API=mock в dev включает мок по контракту — для работы без бэка.
 * Условие статическое: в прод-сборке оно false, и мок вырезается целиком.
 */
export const isDictionaryMock = import.meta.env.DEV && import.meta.env.VITE_DICTIONARIES_API === 'mock'

export const dictionaryApi = isDictionaryMock ? mockDictionaryApi : httpDictionaryApi
