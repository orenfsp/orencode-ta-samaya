import { request } from '@/shared/api'
import type { StoredFile } from '../model/types'

export const fileApi = {
  /** Файл уходит multipart-формой; тип и размер бэк проверяет сам (413 / 415) */
  upload: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<StoredFile>('/files', { method: 'POST', body })
  },
}
