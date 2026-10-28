import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { squadApi } from '../api/squad-api'
import type { SquadTarget } from './types'

export const squadKeys = {
  all: ['squads'] as const,
  list: (target: SquadTarget) => ['squads', 'list', target] as const,
  badges: (userId: string) => ['squads', 'badges', userId] as const,
  draft: (target: SquadTarget, mainSize: number, reserveSize: number) =>
    ['squads', 'draft', target, mainSize, reserveSize] as const,
}

/** Действующая сборная дисциплины и группы или null, если её нет */
export function useSquad(target: SquadTarget | null) {
  return useQuery({
    queryKey: squadKeys.list(target ?? { discipline_id: 0, group_kind: 'age', group_id: 0 }),
    queryFn: ({ signal }) => squadApi.list(target!, signal),
    select: (page) => page.items[0] ?? null,
    enabled: target !== null,
  })
}

/** Действующие сборные по фильтру: дисциплина, вид группы — для меток и страницы сборных */
export function useSquads(filter: Partial<SquadTarget>) {
  return useQuery({
    queryKey: ['squads', 'list', filter] as const,
    queryFn: ({ signal }) => squadApi.list(filter, signal),
    select: (page) => page.items,
    placeholderData: keepPreviousData,
  })
}

export function useSquadBadges(userId: string | undefined) {
  return useQuery({
    queryKey: squadKeys.badges(userId ?? ''),
    queryFn: ({ signal }) => squadApi.badges(userId!, signal),
    select: (page) => page.items,
    enabled: Boolean(userId),
  })
}

export function useSquadDraft(target: SquadTarget, mainSize: number, reserveSize: number, enabled: boolean) {
  return useQuery({
    queryKey: squadKeys.draft(target, mainSize, reserveSize),
    queryFn: ({ signal }) => squadApi.draft(target, mainSize, reserveSize, signal),
    enabled,
    placeholderData: keepPreviousData,
  })
}
