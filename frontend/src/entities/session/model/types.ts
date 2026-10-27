/** Типы по контракту docs/api_map.md (фичи register, login, me) */

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

export interface Me extends User {
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
