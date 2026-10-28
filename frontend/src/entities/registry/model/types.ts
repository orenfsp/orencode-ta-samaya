import type { Ref } from '@/entities/competition'

export interface RegistryAthlete {
  id: string
  name: string
  birth_date: string
  age: number
  age_group: string | null
  municipality: string | null
  organization: Ref | null
  no_organization: boolean
  disciplines: string[]
  start_year: number | null
  training_stage: string | null
  rank: string | null
  rank_valid_until: string | null
  coaches: string[]
}

export interface RegistryCoach {
  id: string
  name: string
  municipality: string | null
  athletes: number
  disciplines: string[]
}

export type CategoryState = 'valid' | 'expiring' | 'expired' | 'none'

export interface RegistryJudge {
  id: string
  name: string
  municipality: string | null
  category: string | null
  valid_until: string | null
  state: CategoryState
  assignments: number
}

export type HeadcountCut = 'total' | 'discipline' | 'organization' | 'stage' | 'age_group' | 'municipality'

/** Численность занимающихся: на конец каждого года, текущий год — на сегодня */
export interface Headcount {
  years: number[]
  dates: string[]
  cut: HeadcountCut
  total: number[]
  /** Из них зачислены в учебно-тренировочные группы */
  in_groups: number[]
  rows: { label: string; counts: number[] }[]
  /** Откуда взяты цифры: периоды профилей и зачисления в группы */
  sources: string[]
}

export type RegistryQuery = Record<string, string | number | boolean | undefined>
export type Page<T> = { items: T[]; total: number }
