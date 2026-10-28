import type { Role, RoleStatus, UserRole } from '../model/types'

export const roleLabels: Record<Role, string> = {
  athlete: 'Спортсмен',
  coach: 'Тренер',
  judge: 'Судья',
  organizer: 'Организация',
  federation: 'Сотрудник ФСП',
}

export const roleStatusLabels: Record<RoleStatus, string> = {
  pending: 'На проверке',
  verified: 'Подтверждена',
  rejected: 'Отклонена',
}

/** Кабинет открыт: спортсмен всегда, тренер при любом статусе, остальные — после подтверждения */
export const hasCabinetAccess = ({ role, status }: Pick<UserRole, 'role' | 'status'>) =>
  role === 'athlete' || role === 'coach' || status === 'verified'

export const fullName = (user: { last_name: string; first_name: string; middle_name: string | null }) =>
  [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ')

/** Ранги Codeforces по-русски, без цветов сайта */
export const codeforcesRanks: Record<string, string> = {
  newbie: 'новичок',
  pupil: 'ученик',
  specialist: 'специалист',
  expert: 'эксперт',
  'candidate master': 'кандидат в мастера',
  master: 'мастер',
  'international master': 'международный мастер',
  grandmaster: 'гроссмейстер',
  'international grandmaster': 'международный гроссмейстер',
  'legendary grandmaster': 'легендарный гроссмейстер',
}
