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
