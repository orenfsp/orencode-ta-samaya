/** Типы по контракту API_DOCUMENTATION.md (фичи register, login, me) */

export type Role = 'federation' | 'organizer' | 'athlete' | 'coach' | 'judge'
export type RoleStatus = 'pending' | 'verified' | 'rejected'

/** Роли, которые человек выбирает сам. Все, кроме спортсмена и тренера, работают только после подтверждения ФСП */
export type SelfRole = Role

export interface UserRole {
  role: Role
  status: RoleStatus
  reject_reason: string | null
  onboarding_done: boolean
  created_at: string
}

export interface User {
  id: string
  email: string
  last_name: string
  first_name: string
  middle_name: string | null
  birth_date: string
  roles: UserRole[]
}

/** Codeforces — справочно: на рейтинг ФСП не влияет. Рейтинг обновляется раз в час */
export interface CodeforcesInfo {
  handle: string
  url: string
  rating: number | null
  max_rating: number | null
  rank: string | null
  status: 'pending' | 'ok' | 'not_found'
  updated_at: string | null
}

export interface Me extends User {
  codeforces: CodeforcesInfo | null
  /** Почта подтверждена кодом: только на неё уходят письма о решениях */
  email_verified: boolean
  /** Класс или «Студенты»: без неё не подать заявку на соревнование */
  academic_group: { id: number; name: string } | null
  /** Роли, кабинеты которых открыты прямо сейчас */
  available_roles: Role[]
}

export interface RegisterInput {
  email: string
  password: string
  password_repeat: string
  last_name: string
  first_name: string
  middle_name: string | null
  birth_date: string
  roles: SelfRole[]
  pd_consent: true
}

export interface LoginInput {
  email: string
  password: string
}

export interface ResetPasswordInput {
  token: string
  password: string
  password_repeat: string
}

/** Данные аккаунта — общие для всех ролей. Поля, которых нет, не меняются */
export interface ProfileInput {
  last_name?: string
  first_name?: string
  middle_name?: string | null
  birth_date?: string
  academic_group_id?: number | null
}
