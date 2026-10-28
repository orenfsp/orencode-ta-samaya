import {
  isOpenForChanges,
  useAvailableContests,
  useMyApplications,
  type Application,
  type ApplicationRole,
} from '@/entities/application'
import type { CompetitionSummary } from '@/entities/competition'

/** Соревнование глазами спортсмена или тренера: все его заявки на него — в одном месте, одной карточкой */
export interface ContestEntry {
  contest: CompetitionSummary
  applications: Application[]
  /** Регистрация открыта: можно подать новую заявку */
  open: boolean
  /** Почему спортсмен не проходит (возраст, группа); пусто — проходит */
  problems: string[]
}

/** Ждёт ли заявка ответа от человека на приглашение */
export const isInvited = (item: Application, userId: string) =>
  isOpenForChanges(item) &&
  item.members.some(
    (member) => member.user.id === userId && member.confirmation === 'invited' && member.is_active,
  )

/** Может ли человек подать ещё одну заявку: тренер — сколько угодно, спортсмен — одну на соревнование */
export const canApply = (entry: ContestEntry, role: ApplicationRole) =>
  entry.open && !entry.problems.length && (role === 'coach' || !entry.applications.length)

/**
 * Куда можно записаться и где уже есть заявки — одним списком без повторов соревнований.
 * Сверху то, где ждут ответа на приглашение, потом свои заявки, потом открытая регистрация.
 */
export function useContestEntries(role: ApplicationRole, userId: string | undefined) {
  const mine = useMyApplications(role)
  const available = useAvailableContests(role, true)
  const entries = new Map<number, ContestEntry>()

  for (const item of available.data ?? [])
    entries.set(item.contest.id, {
      contest: item.contest,
      applications: [],
      open: true,
      problems: item.problems,
    })
  for (const item of mine.data ?? []) {
    if (item.status === 'withdrawn') continue
    const entry = entries.get(item.contest.id) ?? {
      contest: item.contest,
      applications: [],
      open: false,
      problems: [],
    }
    entry.applications.push(item)
    entries.set(item.contest.id, entry)
  }

  const rank = (entry: ContestEntry) =>
    userId && entry.applications.some((item) => isInvited(item, userId))
      ? 0
      : entry.applications.length
        ? 1
        : 2
  const data = [...entries.values()].sort(
    (a, b) => rank(a) - rank(b) || a.contest.starts_on.localeCompare(b.contest.starts_on),
  )

  return {
    data,
    isPending: mine.isPending || available.isPending,
    isError: mine.isError || available.isError,
    error: mine.error ?? available.error,
    refetch: () => Promise.all([mine.refetch(), available.refetch()]),
  }
}
