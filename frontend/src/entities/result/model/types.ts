import type { CompetitionScope, CompetitionStatus, ParticipationType } from '@/entities/competition'

export interface ResultAthlete {
  id: string
  full_name: string
}

/** Место в публичной таблице: команда занимает одно место, баллы у всех участников одинаковые */
export interface ContestPlace {
  /** null — дисквалификация */
  place: number | null
  points: number
  team_name: string | null
  athletes: ResultAthlete[]
}

export interface ContestResults {
  participation_type: ParticipationType
  is_verified: boolean
  items: ContestPlace[]
}

/** Одобренная заявка в форме мест */
export interface ResultEntry {
  application_id: number
  team_name: string | null
  athletes: ResultAthlete[]
  /** Место уже внесено (в том числе дисквалификация) */
  entered: boolean
  place: number | null
}

export interface ResultsForm {
  contest_id: number
  status: CompetitionStatus
  participation_type: ParticipationType
  editable: boolean
  items: ResultEntry[]
}

export interface PlaceInput {
  application_id: number
  place: number | null
}

export type ResultsScope = CompetitionScope

/** Строка протокола из файла и найденная для неё заявка */
export interface ImportRow {
  line: number
  name: string
  place: number | null
  disqualified: boolean
  points: string | null
  /** matched — нашли однозначно, doubtful — совпала часть ФИО или несколько заявок, unmatched — не нашли */
  status: 'matched' | 'doubtful' | 'unmatched'
  application_id: number | null
  candidates: number[]
  note: string | null
}

export interface ImportPreview {
  file_name: string
  matched: number
  doubtful: number
  unmatched: number
  rows: ImportRow[]
  entries: ResultEntry[]
  /** Одобренные заявки, которых нет в файле */
  missing: number[]
}
