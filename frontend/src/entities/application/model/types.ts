import type { CompetitionStatus, CompetitionSummary, ParticipationType, Ref } from '@/entities/competition'

/** Типы по контракту docs/001_api_map.md, раздел «Заявки», и docs/010_tz_applications.md */

export type ApplicationStatus = 'forming' | 'submitted' | 'approved' | 'rejected' | 'withdrawn'
export type MemberConfirmation = 'invited' | 'confirmed' | 'declined'
/** От чьего лица заявка: спортсмен в составе сам, тренер собирает подопечных */
export type ApplicationRole = 'athlete' | 'coach'
/** Кто модерирует: организатор — свои соревнования, федерация — все */
export type ModerationScope = 'organizer' | 'admin'

export interface Person {
  id: string
  last_name: string
  first_name: string
  middle_name: string | null
  birth_date: string
}

export interface ApplicationMember {
  user: Person & { academic_group?: Ref | null; email?: string }
  is_captain: boolean
  confirmation: MemberConfirmation
  confirmation_title: string
  is_active: boolean
  /** Снимок на момент подачи; до подачи — null */
  age_group: Ref | null
  academic_group: Ref | null
}

export interface Application {
  id: number
  contest: CompetitionSummary
  team_name: string | null
  status: ApplicationStatus
  status_title: string
  created_as: ApplicationRole
  creator: Omit<Person, 'birth_date'>
  reject_reason: string | null
  submitted_at: string | null
  decided_at: string | null
  created_at: string
  members: ApplicationMember[]
}

/** Заявка в модерации: вместо карточки соревнования — его id, у людей есть email */
export interface ModeratedApplication extends Omit<Application, 'contest' | 'creator'> {
  contest_id: number
  creator: Person & { email: string }
  decided_by: (Person & { email: string }) | null
}

export interface ContestWithApplications {
  contest: {
    id: number
    title: string
    discipline: Ref
    participation_type: ParticipationType
    participation_type_title: string
    team_size_min: number | null
    team_size_max: number | null
    starts_on: string
    ends_on: string
    registration_closes_at: string
    status: CompetitionStatus
    status_title: string
    organizer: Person & { email: string }
  }
  counts: Record<ApplicationStatus, number>
}

export interface AvailableContest {
  contest: CompetitionSummary
  /** Почему не проходит (возраст, группа); пустой список — можно записаться */
  problems: string[]
}

export interface AthleteFound extends Person {
  academic_group: Ref | null
  /** С contest_id: почему не подходит на это соревнование; пустой список — подходит */
  problems: string[] | null
}

export interface ApplicationInput {
  as: ApplicationRole
  team_name?: string | null
  member_ids: string[]
  captain_id?: string | null
}
