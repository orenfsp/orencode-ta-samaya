/** Типы по контракту docs/004_tz_dictionaries.md (с правками: без sort_order, 409 in_use, 422 по полям) */

export type DictionaryKey =
  | 'disciplines'
  | 'municipalities'
  | 'organization_types'
  | 'academic_groups'
  | 'age_groups'
  | 'contest_types'
  | 'contest_levels'
  | 'contest_formats'
  | 'rank_types'
  | 'judge_categories'
  | 'judge_positions'

export interface DictionaryInfo {
  key: DictionaryKey
  title: string
}

export interface DictionaryBase {
  id: number
  name: string
  description: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface AgeGroup extends DictionaryBase {
  min_age: number | null
  max_age: number | null
}

export const rankKinds = ['Спортивный разряд', 'Юношеский разряд', 'Спортивное звание'] as const
export type RankKind = (typeof rankKinds)[number]

export interface RankType extends DictionaryBase {
  rank_kind: RankKind
  min_age: number | null
  validity_months: number | null
  is_lifetime: boolean
  valid_until_age: number | null
}

export interface JudgeCategory extends DictionaryBase {
  validity_months: number | null
}

interface RuleItems {
  age_groups: AgeGroup
  rank_types: RankType
  judge_categories: JudgeCategory
}

/** Запись справочника по ключу: у трёх справочников свои поля-правила, у остальных — только общие */
export type DictionaryItem<K extends DictionaryKey = DictionaryKey> = K extends keyof RuleItems
  ? RuleItems[K]
  : DictionaryBase

/** Любая запись — для общих мест (таблица, меню действий) */
export type AnyDictionaryItem = DictionaryBase & Partial<AgeGroup & RankType & JudgeCategory>

/** Тело создания: всё, кроме служебных полей */
export type DictionaryItemInput = Omit<AnyDictionaryItem, 'id' | 'is_archived' | 'created_at' | 'updated_at'>

export type DictionaryKind = 'simple' | 'age' | 'rank' | 'judge'

export const dictionaryKind = (key: DictionaryKey): DictionaryKind =>
  key === 'age_groups'
    ? 'age'
    : key === 'rank_types'
      ? 'rank'
      : key === 'judge_categories'
        ? 'judge'
        : 'simple'
