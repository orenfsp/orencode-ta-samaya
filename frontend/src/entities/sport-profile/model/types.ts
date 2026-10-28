import type { Ref } from '@/entities/competition'

export type Sex = 'male' | 'female'
export type TrainingStage = 'initial' | 'training' | 'improvement' | 'highest'
export type CoachLinkStatus = 'requested' | 'active' | 'suspended' | 'ended' | 'declined'
export type CoachLinkAction = 'accept' | 'decline' | 'suspend' | 'resume' | 'end'

export interface LinkPerson {
  id: string
  name: string
  birth_date: string
}

export interface CoachLink {
  id: string
  coach: LinkPerson
  athlete: LinkPerson
  discipline: Ref
  status: CoachLinkStatus
  status_title: string
  created_at: string
  updated_at: string
  events: {
    status: CoachLinkStatus
    status_title: string
    actor: string | null
    comment: string | null
    created_at: string
  }[]
}

export interface AntidopingRecord {
  id: string
  passed_on: string
  valid_until: string
  certificate_url: string | null
  file_url: string | null
}

/** Спортивный профиль по кейсу: муниципалитет, организация, дисциплины, год начала, этап, тренеры */
export interface SportProfile {
  municipality: Ref | null
  sex: Sex | null
  organization: Ref | null
  no_organization: boolean
  start_year: number | null
  training_stage: { value: TrainingStage; title: string } | null
  disciplines: Ref[]
  organization_history: { organization: string; valid_from: string; valid_to: string | null }[]
  coaches: CoachLink[]
  antidoping: AntidopingRecord[]
}

export interface SportProfileInput {
  municipality_id: number | null
  sex: Sex | null
  organization_id: number | null
  no_organization: boolean
  start_year: number | null
  training_stage: TrainingStage | null
  discipline_ids: number[]
}

export interface LinkCandidate {
  athlete: LinkPerson
  municipality: string | null
  linked: boolean
}

export const stageTitles: Record<TrainingStage, string> = {
  initial: 'Начальная подготовка',
  training: 'Учебно-тренировочный этап',
  improvement: 'Совершенствование спортивного мастерства',
  highest: 'Высшее спортивное мастерство',
}

export const sexTitles: Record<Sex, string> = { male: 'Мужской', female: 'Женский' }
