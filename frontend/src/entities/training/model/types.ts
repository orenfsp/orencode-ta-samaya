export type TrainingStage = 'initial' | 'training' | 'improvement' | 'highest'
export type SessionFormat = 'offline' | 'online'
export type NormKind = 'ofp' | 'sfp'
export type NormUnit = 'seconds' | 'min_sec' | 'centimeters' | 'times' | 'chars'
export type NormDirection = 'higher' | 'lower'
export type NormState = 'passed' | 'failed' | 'missing' | 'no_sex'
export type AttestationResult = 'transferred' | 'retained'

export interface Ref {
  id: number
  name: string
}

export interface TrainingPerson {
  id: string
  name: string
}

export interface Stage {
  value: TrainingStage
  title: string
}

export interface TrainingGroup {
  id: number
  name: string
  organization: Ref
  discipline: Ref
  stage: Stage
  coach: TrainingPerson
  start_year: number
  is_active: boolean
  size: number
}

export interface Enrollment {
  id: string
  athlete: TrainingPerson
  group: TrainingGroup
  valid_from: string
  valid_to: string | null
  end_reason: 'transferred' | 'expelled' | null
  end_reason_title: string | null
  order_number: string | null
  note: string | null
  previous_id: string | null
}

export interface GroupDetail {
  group: TrainingGroup
  current: Enrollment[]
  history: Enrollment[]
}

export interface GroupQuery {
  organization_id?: number
  discipline_id?: number
  stage?: TrainingStage
  active_only?: boolean
}

export interface GroupInput {
  organization_id?: number
  discipline_id?: number
  stage?: TrainingStage
  coach_id?: string
  name?: string
  start_year?: number
  is_active?: boolean
}

export interface MoveInput {
  on: string
  order_number?: string
  note?: string
}

export interface TrainingSession {
  id: string
  group_id: number
  held_on: string
  topic: string
  format: SessionFormat
  format_title: string
  proof_url: string | null
  proof_file: { id: string; name: string } | null
  note: string | null
  present: number
  marks: { athlete: TrainingPerson; present: boolean }[]
  created_at: string
}

export interface SessionInput {
  held_on: string
  topic: string
  format: SessionFormat
  proof_url?: string
  note?: string
  attendance: { athlete_id: string; present: boolean }[]
}

export interface Attendance {
  total: number
  attended: number
  sessions: TrainingSession[]
  groups: TrainingGroup[]
}

export interface Norm {
  id: number
  stage: Stage
  kind: NormKind
  kind_title: string
  name: string
  unit: NormUnit
  unit_title: string
  direction: NormDirection
  direction_title: string
  threshold_male: string | null
  threshold_female: string | null
  disciplines: Ref[]
  source: string
  is_demo: boolean
  is_archived: boolean
  sort_order: number
}

export interface NormInput {
  stage?: TrainingStage
  kind?: NormKind
  name?: string
  unit?: NormUnit
  direction?: NormDirection
  threshold_male?: number | null
  threshold_female?: number | null
  discipline_ids?: number[]
  source?: string
  is_demo?: boolean
  is_archived?: boolean
}

export interface NormResult {
  id: string
  athlete_id: string
  norm: Norm
  value: string
  threshold: string
  passed: boolean
  passed_on: string
  recorded_by: TrainingPerson | null
}

export interface Attestation {
  id: string
  athlete_id: string
  athlete: TrainingPerson
  group: TrainingGroup
  target_group: TrainingGroup | null
  stage_from: Stage
  stage_to: Stage | null
  result: AttestationResult
  result_title: string
  decided_on: string
  order_number: string | null
  comment: string | null
  is_override: boolean
  actor: TrainingPerson | null
}

export interface NormHistory {
  athlete: string
  results: NormResult[]
  attestations: Attestation[]
}

export interface BoardRow {
  enrollment_id: string
  athlete: TrainingPerson
  since: string
  ready: boolean
  passed: number
  required: number
  norms: {
    norm: Norm
    threshold: string | null
    state: NormState
    best: string | null
    best_on: string | null
  }[]
}

export interface Board {
  group: TrainingGroup
  target_stage: Stage | null
  rows: BoardRow[]
  targets: TrainingGroup[]
  history: Attestation[]
}

export interface DecisionInput {
  athlete_id: string
  group_id: number
  result: AttestationResult
  target_group_id?: number
  on: string
  order_number?: string
  comment?: string
}

export interface OrganizationCard {
  id: number
  name: string
  short_name: string | null
  organization_type: Ref
  municipality: Ref | null
  inn: string | null
  address: string | null
  website: string | null
  license_number: string | null
  license_date: string | null
  is_active: boolean
  programs: { id: number; discipline: Ref; stage: Stage; valid_from: string }[]
  coaches: { id: number; coach: TrainingPerson; position: string; valid_from: string }[]
  groups: TrainingGroup[]
  athletes: number
}
