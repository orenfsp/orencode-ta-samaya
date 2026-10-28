import type { Ref } from '@/entities/competition'
import type { RatingGroupKind } from '@/entities/rating'

/** Сборная по контракту docs/014_tz_squads.md: дисциплина × группа, действует до нового приказа */
export interface SquadMember {
  position: number
  athlete: { id: string; name: string }
  municipality: Ref | null
  points: number
}

export interface Squad {
  id: number
  title: string
  discipline: Ref
  group_kind: RatingGroupKind
  group: Ref
  main_size: number
  reserve_size: number
  order: { number: string; date: string; url: string; file_name: string }
  approved_at: string
  main: SquadMember[]
  reserve: SquadMember[]
}

export interface SquadTarget {
  discipline_id: number
  group_kind: RatingGroupKind
  group_id: number
}

export interface SquadCandidate {
  position: number
  athlete_id: string
  name: string
  municipality: Ref | null
  points: number
}

/** Предпросмотр: кто войдёт, если утвердить сейчас */
export interface SquadDraft {
  title: string
  discipline: Ref
  group_kind: RatingGroupKind
  group: Ref
  main_size: number
  reserve_size: number
  /** Сколько человек в рейтинге группы */
  available: number
  main: SquadCandidate[]
  reserve: SquadCandidate[]
  current: { id: number; order_number: string; order_date: string; main: number; reserve: number } | null
}

export interface SquadForm extends SquadTarget {
  main_size: number
  reserve_size: number
  order_number: string
  order_date: string
  order_file_id: string
}

export interface SquadApproved {
  id: number
  title: string
  link: string
  main: number
  reserve: number
}

/** Метка на странице человека */
export interface SquadBadge {
  squad_id: number
  title: string
  discipline: Ref
  group_kind: RatingGroupKind
  group: Ref
  link: string
}
