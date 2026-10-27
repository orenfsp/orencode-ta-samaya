/** «842 КБ», «3,1 МБ» */
export const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} КБ`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`

const kinds: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/zip': 'ZIP',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
}

/** Тип документа для подписи у ссылки на скачивание */
export const fileKind = (contentType: string) => kinds[contentType] ?? 'Файл'
