import type { RatingGroupKind, RatingRules } from '../model/types'

export const groupKindTitles: Record<RatingGroupKind, string> = {
  age: 'По возрасту',
  academic: 'По учёбе',
}

/** Окно рейтинга по умолчанию, пока правила федерации не загрузились */
export const RATING_WINDOW = 'за 365 дней'

/** Короткая подпись сезона и коэффициента: «последние 365 дней · призёрам 2 стартов ×1,2» */
export function seasonCaption(rules: RatingRules | undefined) {
  if (!rules) return RATING_WINDOW
  const factor = String(rules.stability_factor).replace('.', ',')
  return `${rules.season_title.toLowerCase()} · призёрам ${rules.podium_count}+ стартов ×${factor}`
}
