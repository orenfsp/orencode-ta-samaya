import type { StatusTone } from '@/shared/ui'
import type { Application, ApplicationStatus, MemberConfirmation, Person } from '../model/types'

export const applicationStatusTitles: Record<ApplicationStatus, string> = {
  forming: 'Собирается состав',
  submitted: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  withdrawn: 'Отозвана',
}

export const applicationTone: Record<ApplicationStatus, StatusTone> = {
  forming: 'draft',
  submitted: 'live',
  approved: 'active',
  rejected: 'cancelled',
  withdrawn: 'done',
}

export const confirmationTitles: Record<MemberConfirmation, string> = {
  invited: 'Приглашён',
  confirmed: 'Подтвердил',
  declined: 'Отказался',
}

export const personName = (person: Pick<Person, 'last_name' | 'first_name' | 'middle_name'>) =>
  [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ')

/** Активные участники: отказавшиеся в составе не считаются */
export const activeMembers = (application: Pick<Application, 'members'>) =>
  application.members.filter((member) => member.is_active)

/** Можно ли ещё что-то менять: заявка не отозвана и не отклонена, регистрация открыта */
export const isOpenForChanges = (application: Pick<Application, 'status' | 'contest'>) =>
  ['forming', 'submitted', 'approved'].includes(application.status) &&
  application.contest.status === 'registration_open'

/** Может ли человек менять состав и подавать: автор заявки или капитан */
export const canManage = (item: Pick<Application, 'creator' | 'members'>, userId: string) =>
  item.creator.id === userId ||
  item.members.some((member) => member.is_captain && member.is_active && member.user.id === userId)
