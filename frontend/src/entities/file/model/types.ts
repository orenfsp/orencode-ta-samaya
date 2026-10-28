/** Файл в хранилище по контракту API_DOCUMENTATION.md, раздел «Файлы» */
export interface StoredFile {
  id: string
  original_name: string
  content_type: string
  size: number
  /** Готовая ссылка: прямая на хранилище у публичных файлов, /api/v1/files/{id} — у приватных */
  url: string
}
