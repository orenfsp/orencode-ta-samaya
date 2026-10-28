import type { RatingGroupKind } from '../model/types'

export const groupKindTitles: Record<RatingGroupKind, string> = {
  age: 'По возрасту',
  academic: 'По учёбе',
}

/** Окно рейтинга: места за последние 365 дней */
export const RATING_WINDOW = 'за 365 дней'
