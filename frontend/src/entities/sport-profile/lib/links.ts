import type { StatusTone } from '@/shared/ui'
import type { CoachLinkAction, CoachLinkStatus } from '../model/types'

export const linkTone: Record<CoachLinkStatus, StatusTone> = {
  requested: 'draft',
  active: 'active',
  suspended: 'done',
  ended: 'done',
  declined: 'cancelled',
}

export const linkActionLabels: Record<CoachLinkAction, string> = {
  accept: 'Принять',
  decline: 'Отклонить',
  suspend: 'Приостановить',
  resume: 'Возобновить',
  end: 'Завершить',
}

/** Что можно сделать со связью: спортсмен решает по запросу, дальше управляют оба */
export function linkActions(status: CoachLinkStatus, asAthlete: boolean): CoachLinkAction[] {
  if (status === 'requested') return asAthlete ? ['accept', 'decline'] : ['end']
  if (status === 'active') return ['suspend', 'end']
  if (status === 'suspended') return ['resume', 'end']
  return []
}
