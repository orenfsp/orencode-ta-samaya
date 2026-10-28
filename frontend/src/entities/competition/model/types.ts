/** Типы по контракту docs/001_api_map.md, раздел «Соревнования», и docs/007_tz_competitions.md */

export type CompetitionStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'archived'
  | 'cancelled'

export type VerificationStatus = 'not_requested' | 'pending' | 'verified' | 'rejected'

export type ParticipationType = 'individual' | 'team'

/** Переходы жизненного цикла без тела запроса; отмена — отдельно, с причиной */
export type CompetitionAction =
  'publish' | 'unpublish' | 'open-registration' | 'close-registration' | 'start' | 'complete' | 'archive'

/** Раздел кабинета: организатор видит свои соревнования, федерация — все */
export type CompetitionScope = 'organizer' | 'admin'

export interface Ref {
  id: number
  name: string
}

export interface CompetitionFile {
  id: string
  original_name: string
  content_type: string
  size: number
  url: string
}

export interface RatingPoint {
  place: number
  points: number
}

export interface CompetitionOrganizer {
  id: string
  last_name: string
  first_name: string
  middle_name: string | null
  full_name: string
}

export interface Competition {
  id: number
  title: string
  description: string | null
  discipline: Ref
  contest_type: Ref
  contest_level: Ref
  contest_format: Ref
  participation_type: ParticipationType
  participation_type_title: string
  team_size_min: number | null
  team_size_max: number | null
  municipality: Ref | null
  venue: string | null
  age_groups: Ref[]
  academic_groups: Ref[]
  starts_on: string
  ends_on: string
  registration_opens_at: string
  registration_closes_at: string
  prize_fund_text: string | null
  prize_fund_amount: number | null
  regulations: CompetitionFile | null
  photos: CompetitionFile[]
  status: CompetitionStatus
  status_title: string
  cancel_reason: string | null
  is_verified: boolean
  /** Публично — только у верифицированных */
  rating_points: RatingPoint[] | null
  organizer: CompetitionOrganizer
  published_at: string | null
}

/** Краткая карточка соревнования: в заявках и в списке «куда можно записаться» */
export type CompetitionSummary = Pick<
  Competition,
  | 'id'
  | 'title'
  | 'discipline'
  | 'contest_level'
  | 'contest_format'
  | 'participation_type'
  | 'participation_type_title'
  | 'team_size_min'
  | 'team_size_max'
  | 'municipality'
  | 'venue'
  | 'age_groups'
  | 'academic_groups'
  | 'starts_on'
  | 'ends_on'
  | 'registration_opens_at'
  | 'registration_closes_at'
  | 'prize_fund_text'
  | 'prize_fund_amount'
  | 'photos'
  | 'status'
  | 'status_title'
  | 'is_verified'
>

/** Карточка для владельца и федерации: плюс верификация и служебные даты */
export interface ManagedCompetition extends Competition {
  verification_status: VerificationStatus
  verification_title: string
  verification_reason: string | null
  verification_requested_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface Page<T> {
  items: T[]
  total: number
}

export interface CompetitionInput {
  title: string
  description: string | null
  discipline_id: number
  contest_type_id: number
  contest_level_id: number
  contest_format_id: number
  participation_type: ParticipationType
  team_size_min: number | null
  team_size_max: number | null
  municipality_id: number | null
  venue: string | null
  age_group_ids: number[]
  academic_group_ids: number[]
  starts_on: string
  ends_on: string
  registration_opens_at: string
  registration_closes_at: string
  prize_fund_text: string | null
  prize_fund_amount: number | null
  regulations_file_id: string | null
  photo_file_ids: string[]
  /** Только федерация */
  organizer_id?: string
  /** Только федерация при создании: сразу верифицировать с этими баллами */
  rating_points?: RatingPoint[]
}

export interface LevelPoints {
  level: Ref
  rating_points: RatingPoint[]
}

export interface CompetitionFilters {
  discipline_id?: string
  contest_level_id?: string
  contest_format_id?: string
  participation_type?: string
  age_group_id?: string
  academic_group_id?: string
  municipality_id?: string
  status?: string
  verification_status?: string
  verified_only?: boolean
  has_prize_fund?: boolean
  date_from?: string
  date_to?: string
  search?: string
  period?: 'upcoming' | 'past' | 'all'
  sort?: CompetitionSort
}

/** Порядок списка: свежие по дате, ближайшие, недавно добавленные, по алфавиту */
export type CompetitionSort = 'date_desc' | 'date_asc' | 'created_desc' | 'title'
