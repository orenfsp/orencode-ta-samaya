import { plural } from '@/shared/lib'
import type { Role } from '@/entities/session'
import type { WallRole } from '../model/types'

export const wallRoles: WallRole[] = ['athlete', 'coach', 'judge', 'organizer']
export const isWallRole = (role: Role): role is WallRole => (wallRoles as Role[]).includes(role)

/** Порядок вкладок на странице */
export const pageRoleOrder: Role[] = ['athlete', 'coach', 'judge', 'organizer']

export const pageRoleTitles: Record<Role, string> = {
  athlete: 'Спортсмен',
  coach: 'Тренер',
  judge: 'Судья',
  organizer: 'Организатор',
  federation: 'Сотрудник ФСП',
}

const short = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** «14 нояб.» для ленты */
export const shortDay = (value: string) => short.format(new Date(`${value}T12:00:00Z`))

/** «2 дня» — длительность соревнования, если больше дня */
export function duration(startsOn: string, endsOn: string) {
  const days = Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1
  return days < 2 ? undefined : `${days} ${plural(days, ['день', 'дня', 'дней'])}`
}

export const athletesLabel = (count: number) =>
  `${count} ${plural(count, ['спортсмен', 'спортсмена', 'спортсменов'])}`
