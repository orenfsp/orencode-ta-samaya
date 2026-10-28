import type { Ref } from '@/entities/competition'

/** Рейтинг строится либо по возрастной, либо по академической группе */
export type RatingGroupKind = 'age' | 'academic'

export interface RatingLine {
  place: number
  athlete: { id: string; full_name: string }
  municipality: Ref | null
  points: number
  /** Сколько мест учтено за сезон */
  contests: number
  /** Сумма баллов до коэффициента стабильности */
  base: number
  /** Сколько раз призёр за сезон */
  podiums: number
  /** Применённый коэффициент стабильности или null */
  factor: number | null
  /** Расшифровка итога: «45 + 40 + 0 = 85 × 1,2 = 102» */
  explain: string
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
  base: number
  podiums: number
  factor: number | null
  explain: string
  scores: RatingScore[]
}

export type RatingSeason = 'rolling' | 'calendar'

/** Правила подсчёта рейтинга, которые задаёт федерация */
export interface RatingRules {
  stability_factor: number
  podium_place: number
  podium_count: number
  season: RatingSeason
  season_title: string
  /** Первый день текущего сезона */
  since: string
  formula: string
}

export interface RatingRulesInput {
  stability_factor: number
  podium_place: number
  podium_count: number
  season: RatingSeason
}

/** Своё место в рейтингах и причины, почему в части рейтингов тебя нет */
export interface RatingStatus {
  rules: RatingRules
  in_rating: boolean
  standings: RatingStanding[]
  reasons: { code: string; text: string }[]
}

export interface RatingFilters {
  discipline_id?: string
  municipality_id?: string
  group_kind?: RatingGroupKind
  /** Разряд не ниже: id из справочника разрядов */
  min_rank_id?: string
}

export interface RatingTableQuery extends RatingFilters {
  discipline_id: string
  group_kind: RatingGroupKind
  group_id: string
  search?: string
}
