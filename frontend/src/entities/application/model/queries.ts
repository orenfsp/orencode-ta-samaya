import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { applicationApi } from '../api/application-api'
import type { ApplicationRole, ApplicationStatus, ModerationScope } from './types'

export const applicationKeys = {
  all: ['applications'] as const,
  mine: (as: ApplicationRole) => ['applications', 'mine', as] as const,
  available: (as: ApplicationRole) => ['applications', 'available', as] as const,
  athletes: (q: string, contestId: number | null) => ['applications', 'athletes', q, contestId] as const,
  contests: (scope: ModerationScope) => ['applications', scope, 'contests'] as const,
  moderated: (
    scope: ModerationScope,
    contestId: number,
    filters: { status?: ApplicationStatus; search?: string },
    limit: number,
  ) => ['applications', scope, contestId, filters, limit] as const,
}

export function useMyApplications(as: ApplicationRole) {
  return useQuery({
    queryKey: applicationKeys.mine(as),
    queryFn: ({ signal }) => applicationApi.mine(as, signal),
    select: (page) => page.items,
  })
}

/** Куда можно записаться: спортсмену — с причинами недопуска, тренеру — все с открытой регистрацией */
export function useAvailableContests(as: ApplicationRole, enabled: boolean) {
  return useQuery({
    queryKey: applicationKeys.available(as),
    queryFn: ({ signal }) => applicationApi.available(as, signal),
    select: (page) => page.items,
    enabled,
  })
}

/** Поиск спортсменов от 2 символов по части ФИО или email: с contestId сервер сразу говорит, кто не проходит и почему */
export function useAthleteSearch(q: string, contestId: number | null) {
  const text = q.trim()
  return useQuery({
    queryKey: applicationKeys.athletes(text, contestId),
    queryFn: ({ signal }) => applicationApi.searchAthletes(text, contestId, signal),
    select: (page) => page.items,
    enabled: text.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useContestsWithApplications(scope: ModerationScope) {
  return useQuery({
    queryKey: applicationKeys.contests(scope),
    queryFn: ({ signal }) => applicationApi.contests(scope, signal),
  })
}

export function useModeratedApplications(
  scope: ModerationScope,
  contestId: number | null,
  filters: { status?: ApplicationStatus; search?: string },
  limit: number,
) {
  return useQuery({
    queryKey: applicationKeys.moderated(scope, contestId ?? 0, filters, limit),
    queryFn: ({ signal }) => applicationApi.moderated(scope, contestId!, filters, limit, signal),
    enabled: contestId != null,
    // Прежний список держим только внутри того же соревнования: «Показать ещё» и фильтры не мигают
    placeholderData: (previous, query) => (query?.queryKey[2] === contestId ? previous : undefined),
  })
}
