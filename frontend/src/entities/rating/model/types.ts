import type { Ref } from '@/entities/competition'

/** Рейтинг строится либо по возрастной, либо по академической группе */
export type RatingGroupKind = 'age' | 'academic'

export interface RatingLine {
  place: number
  athlete: { id: string; full_name: string }
  municipality: Ref | null
  points: number
  /** Сколько мест учтено за год */
  contests: number
}

/** Один рейтинг: дисциплина + группа */
export interface RatingBoard {
  discipline: Ref
  group_kind: RatingGroupKind
  group: Ref
  total: number
  items: RatingLine[]
}

export interface RatingScore {
  contest: { id: number; title: string; ends_on: string }
  place: number | null
  points: number
}

/** Положение спортсмена в одном рейтинге с расшифровкой баллов */
export interface RatingStanding {
  discipline: Ref
  group_kind: RatingGroupKind
  group: Ref
  place: number
  total: number
  points: number
  contests: number
  scores: RatingScore[]
}

export interface RatingFilters {
  discipline_id?: string
  municipality_id?: string
  group_kind?: RatingGroupKind
}

export interface RatingTableQuery extends RatingFilters {
  discipline_id: string
  group_kind: RatingGroupKind
  group_id: string
  search?: string
}
