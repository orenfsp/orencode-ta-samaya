import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { flatPages, offsetPaging } from '@/shared/api'
import { personApi } from '../api/person-api'
import type { WallRole } from './types'

export const personKeys = {
  all: ['people'] as const,
  detail: (id: string) => ['people', id] as const,
  wall: (id: string, role: WallRole, step: number) => ['people', id, 'wall', role, step] as const,
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: personKeys.detail(id),
    queryFn: ({ signal }) => personApi.get(id, signal),
    enabled: Boolean(id),
  })
}

/** Лента человека по роли: «Показать ещё» догружает следующую страницу по offset */
export function useWall(id: string, role: WallRole | null, step: number) {
  return useInfiniteQuery({
    queryKey: personKeys.wall(id, role ?? 'athlete', step),
    queryFn: ({ pageParam, signal }) => personApi.wall(id, role!, step, pageParam, signal),
    ...offsetPaging,
    select: flatPages,
    enabled: Boolean(id && role),
  })
}
