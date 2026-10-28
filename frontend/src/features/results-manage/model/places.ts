/** Как на сервере: у каждой заявки своё место, подряд с 1. Дисквалифицированные — без места */
export function placesValid(places: number[]) {
  const ordered = [...places].sort((a, b) => a - b)
  return ordered.every((place, index) => place === index + 1)
}

export interface PlaceDraft {
  place: string
  disqualified: boolean
}
