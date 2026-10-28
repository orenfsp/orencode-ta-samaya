import type { NormState, NormUnit, TrainingStage } from '../model/types'

export const stageOptions: { value: TrainingStage; label: string; short: string }[] = [
  { value: 'initial', label: 'Начальная подготовка', short: 'НП' },
  { value: 'training', label: 'Учебно-тренировочный этап', short: 'УТ' },
  { value: 'improvement', label: 'Совершенствование спортивного мастерства', short: 'ССМ' },
  { value: 'highest', label: 'Высшее спортивное мастерство', short: 'ВСМ' },
]

export const unitOptions: { value: NormUnit; label: string }[] = [
  { value: 'seconds', label: 'Секунды' },
  { value: 'min_sec', label: 'Минуты и секунды' },
  { value: 'centimeters', label: 'Сантиметры' },
  { value: 'times', label: 'Количество раз' },
  { value: 'chars', label: 'Знаков в минуту' },
]

export const normStateTitles: Record<NormState, string> = {
  passed: 'Выполнен',
  failed: 'Не выполнен',
  missing: 'Не сдавал',
  no_sex: 'Не указан пол',
}

/** Значение норматива для таблицы: «мин, с» — 6:20, секунды — 6,3, остальное — целым */
export function formatNormValue(value: string | number | null, unit: NormUnit) {
  if (value === null || value === '') return '—'
  const number = Number(value)
  if (unit === 'min_sec') {
    const seconds = Math.round(number)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }
  if (unit === 'seconds') return number.toFixed(1).replace('.', ',')
  if (unit === 'centimeters') return `${number > 0 ? '+' : ''}${Math.round(number)}`
  return String(Math.round(number))
}

/** Разбор ввода: «6:20» для «мин, с» → 380 секунд, «6,3» → 6.3. NaN, если не число */
export function parseNormValue(text: string, unit: NormUnit) {
  const clean = text.trim().replace(',', '.')
  if (unit === 'min_sec' && clean.includes(':')) {
    const [minutes, seconds] = clean.split(':')
    return Number(minutes) * 60 + Number(seconds)
  }
  return clean ? Number(clean) : Number.NaN
}

export const unitHint: Record<NormUnit, string> = {
  seconds: 'с',
  min_sec: 'мин:с',
  centimeters: 'см',
  times: 'раз',
  chars: 'знаков',
}
