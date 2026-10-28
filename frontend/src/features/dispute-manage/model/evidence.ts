export interface Evidence {
  url: string
  files: { id: string; name: string }[]
}

export const emptyEvidence: Evidence = { url: '', files: [] }

/** Тело доказательств для API: ссылка или null, id файлов */
export const evidenceBody = (value: Evidence) => ({
  evidence_url: value.url.trim() || null,
  file_ids: value.files.map((file) => file.id),
})
