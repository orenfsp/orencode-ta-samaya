/** Файл в хранилище по контракту docs/001_api_map.md, раздел «Файлы» */
export interface StoredFile {
  id: string
  original_name: string
  content_type: string
  size: number
  /** Готовая ссылка: прямая на хранилище у публичных файлов, /api/v1/files/{id} — у приватных */
  url: string
}
