export type AppealStatus = 'submitted' | 'reviewing' | 'upheld' | 'rejected' | 'withdrawn'
export type ViolationStatus = 'reported' | 'decided' | 'dismissed'
export type Sanction = 'warning' | 'technical_defeat' | 'disqualification' | 'suspension'

export interface DisputePerson {
  id: string
  name: string
}

export interface DisputeFile {
  id: string
  name: string
  url: string
}

export interface DisputeContest {
  id: number
  title: string
  ends_on: string
}

/** Апелляция на место заявки */
export interface Appeal {
  id: string
  contest: DisputeContest
  application_id: number
  /** «команда «Байтики»» или ФИО участника личной заявки */
  entry: string
  filer: DisputePerson
  current_place: number | null
  requested_place: number | null
  reason: string
  evidence_url: string | null
  files: DisputeFile[]
  status: AppealStatus
  status_title: string
  decision: string | null
  decided_at: string | null
  created_at: string
}

/** Рапорт о нарушении и решение. Автора и доказательства видят судьи, организатор и федерация */
export interface Violation {
  id: string
  contest: DisputeContest
  athlete: DisputePerson
  reporter: DisputePerson | null
  description: string
  evidence_url: string | null
  files: DisputeFile[]
  status: ViolationStatus
  status_title: string
  sanction: Sanction | null
  sanction_title: string | null
  suspended_until: string | null
  decision: string | null
  decided_at: string | null
  created_at: string
}

export interface ContestDisputes {
  /** Организатор, федерация или судья коллегии: видит всё */
  privileged: boolean
  can_report: boolean
  /** До какого дня включительно принимаются апелляции */
  appeal_until: string
  appeals: Appeal[]
  violations: Violation[]
  /** Свои заявки с местами: на них можно подать апелляцию */
  entries: { application_id: number; title: string; place: number | null }[]
  /** Участники для рапорта о нарушении */
  participants: { application_id: number; athlete: DisputePerson; team_name: string | null }[]
}

export interface DisputeList {
  appeals: Appeal[]
  violations: Violation[]
}

export interface AppealInput {
  application_id: number
  requested_place: number | null
  reason: string
  evidence_url: string | null
  file_ids: string[]
}

export interface ViolationInput {
  user_id: string
  description: string
  evidence_url: string | null
  file_ids: string[]
}

export interface AppealDecision {
  upheld: boolean
  decision: string
  places: { application_id: number; place: number | null }[]
}

export interface ViolationDecision {
  sanction: Sanction | null
  decision: string
  suspended_until: string | null
}

/** Соревнование, где можно подать апелляцию сейчас: места внесены, срок не прошёл */
export interface Appealable {
  contest: { id: number; title: string; starts_on: string; ends_on: string }
  appeal_until: string
  entries: ContestDisputes['entries']
}
