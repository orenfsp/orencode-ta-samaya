import type { CompetitionStatus, ParticipationType, Ref } from '@/entities/competition'
import type { CodeforcesInfo, Role } from '@/entities/session'

/** Роль, у которой есть лента соревнований */
export type WallRole = 'athlete' | 'coach' | 'judge' | 'organizer'

/** Публичная страница. У несовершеннолетнего для чужих: имя и буква фамилии, без даты рождения и фото */
export interface Person {
  id: string
  name: string
  last_name: string | null
  first_name: string
  middle_name: string | null
  birth_date: string | null
  academic_group: Ref | null
  avatar_url: string | null
  roles: Role[]
  is_owner: boolean
  /** Несовершеннолетний для постороннего: без фамилии, даты рождения и фото */
  masked: boolean
  /** Справочно, на рейтинг ФСП не влияет */
  codeforces: CodeforcesInfo | null
}

export interface WallContest {
  id: number
  title: string
  discipline: Ref
  contest_level: Ref
  contest_format: Ref
  participation_type: ParticipationType
  starts_on: string
  ends_on: string
  status: CompetitionStatus
}

export interface WallPost {
  id: string
  text: string | null
  photos: { id: string; url: string }[]
  is_hidden: boolean
  hidden_by_federation: boolean
}

export interface WallEntry {
  contest: WallContest
  team_name: string | null
  /** Тренер: сколько подопечных выступало */
  athletes: number | null
  /** Спортсмен — своё место, тренер — лучшее место подопечных. Пока места не внесены — null */
  place: number | null
  /** Спортсмен дисквалифицирован */
  disqualified: boolean
  /** Судья: должность в коллегии */
  position?: string | null
  post: WallPost | null
}

export interface PostInput {
  text: string | null
  photo_ids: string[]
  is_hidden: boolean
}

export interface PageInput {
  avatar_file_id?: string | null
}
