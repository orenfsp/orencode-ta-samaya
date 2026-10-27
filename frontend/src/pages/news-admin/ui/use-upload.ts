import { useState } from 'react'
import { fileApi } from '@/entities/file'

/**
 * Загрузка вложений статьи. Обложка и картинки блоков могут грузиться одновременно,
 * поэтому считаем активные загрузки; имена файлов запоминаем, в статье хранится только id.
 */
export function useUploads() {
  const [active, setActive] = useState<string[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const upload = async (slot: string, file: File, done: (id: string) => void) => {
    setActive((current) => [...current, slot])
    setError(null)
    try {
      const result = await fileApi.upload(file)
      setNames((current) => ({ ...current, [result.id]: result.original_name }))
      done(result.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не получилось загрузить файл')
    } finally {
      setActive((current) => current.filter((item) => item !== slot))
    }
  }

  return {
    upload,
    busy: active.length > 0,
    loading: (slot: string) => active.includes(slot),
    name: (id: string) => names[id],
    error,
  }
}

export type Uploads = ReturnType<typeof useUploads>
