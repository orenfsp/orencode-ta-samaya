export type DeadlineKind = 'registration' | 'rank' | 'category' | 'antidoping' | 'governor' | 'report'

/** Срок в пределах прав роли: закрытие приёма заявок, разряд, категория, РУСАДА, премии, отчёты */
export interface Deadline {
  kind: DeadlineKind
  title: string
  detail: string
  due: string
  days_left: number
  link: string
}

export interface ReportDeadline {
  id: number
  title: string
  description: string | null
  recipient: string | null
  due_on: string
  done_at: string | null
  days_left: number
}

export interface ReportDeadlineInput {
  title: string
  due_on: string
  description?: string | null
  recipient?: string | null
  done?: boolean
}

export interface ReadinessCheck {
  key: string
  step: 'prepare' | 'registration' | 'event' | 'after'
  title: string
  done: boolean
  hint: string
  warning: string | null
}

export interface Readiness {
  contest_id: number
  done: number
  total: number
  items: ReadinessCheck[]
}

export const deadlineKindTitles: Record<DeadlineKind, string> = {
  registration: 'Приём заявок',
  rank: 'Разряд',
  category: 'Судейская категория',
  antidoping: 'Антидопинг',
  governor: 'Премии Губернатора',
  report: 'Отчёт',
}
