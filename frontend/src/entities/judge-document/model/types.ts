export type JudgeDocumentKind = 'note' | 'act' | 'protocol' | 'other'

/** Документ судьи к протоколу: виден всем сразу, без проверки */
export interface JudgeDocument {
  id: string
  kind: JudgeDocumentKind
  kind_title: string
  judge_id: string
  judge_name: string
  position: string | null
  /** Судью сняли с коллегии: файл остаётся, менять его нельзя */
  removed: boolean
  file_name: string
  file_type: string
  file_size: number
  url: string
  comment: string | null
  created_at: string
  updated_at: string
}

export interface JudgeDocumentInput {
  kind: JudgeDocumentKind
  file_id?: string
  comment?: string
}

export const judgeDocumentKinds: { value: JudgeDocumentKind; label: string }[] = [
  { value: 'note', label: 'Судейская записка' },
  { value: 'act', label: 'Акт' },
  { value: 'protocol', label: 'Протокол судьи' },
  { value: 'other', label: 'Другое' },
]
