/** Разряды и судейские категории по контракту docs/013_tz_judges_ranks.md */
export type QualificationKind = 'judge_category' | 'rank'
export type QualificationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'superseded'

export interface QualificationPerson {
  id: string
  name: string
  birth_date: string
}

export interface Qualification {
  id: string
  kind: QualificationKind
  kind_title: string
  item_id: number
  item_name: string
  status: QualificationStatus
  status_title: string
  user: QualificationPerson
  submitted_by: QualificationPerson
  document_file_id: string
  document_name: string
  basis: string | null
  reject_reason: string | null
  valid_from: string | null
  /** null у одобренной — бессрочно (звание) */
  valid_until: string | null
  decided_at: string | null
  created_at: string
}

export interface MyQualifications {
  items: Qualification[]
  /** Поданные тренером за спортсменов */
  submitted: Qualification[]
}

export interface QualificationInput {
  kind: QualificationKind
  user_id?: string
  item_id: number
  document_file_id: string
  basis?: string
}

export interface JudgeCategoryRef {
  name: string
  valid_until: string | null
}

export interface JudgeAssignment {
  id: string
  judge: QualificationPerson
  position: { id: number; name: string }
  category: JudgeCategoryRef | null
}

export interface JudgePanel {
  contest_id: number
  starts_on: string
  items: JudgeAssignment[]
}

export interface JudgeCandidate {
  judge: QualificationPerson
  /** Категория, действующая на дату соревнования; null — назначить нельзя */
  category: JudgeCategoryRef | null
}

export interface MyJudgeAssignment {
  id: string
  contest: { id: number; title: string; starts_on: string; ends_on: string; status: string }
  position: { id: number; name: string }
}
