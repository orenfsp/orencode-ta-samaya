import type { Ref } from '@/entities/competition'

/** Правило ЕВСК: на каком уровне, до какого места и при каком составе даётся разряд */
export interface EvskRule {
  id: number
  rank_type: Ref
  contest_level: Ref
  discipline: Ref | null
  place_to: number
  min_participants: number
  min_age: number | null
  max_age: number | null
  source: string | null
  /** Демо-значение: официальная норма ещё не внесена */
  is_demo: boolean
  note: string | null
}

export interface EvskRuleInput {
  rank_type_id: number
  contest_level_id: number
  discipline_id: number | null
  place_to: number
  min_participants: number
  min_age: number | null
  max_age: number | null
  source: string | null
  is_demo: boolean
  note: string | null
}

/** Результат в протоколе, который может соответствовать разряду */
export interface EvskCandidate {
  user_id: string
  name: string
  contest_id: number
  contest_title: string
  ends_on: string
  place: number
  result_id: number
  rank: string
  rank_type_id: number
  rule_demo: boolean
  current: string | null
}

export interface PersonalPath {
  current: string | null
  current_valid_until: string | null
  next: { rank: Ref; rules: EvskRule[] } | null
  later: Ref[]
  contests: { id: number; title: string; starts_on: string; level: string; registration_closes_at: string }[]
  achieved: EvskCandidate[]
}
