import { useQuery } from '@tanstack/react-query'
import { trainingApi } from '../api/training-api'
import type { GroupQuery, TrainingStage } from './types'

export const trainingKeys = {
  all: ['training'] as const,
  card: (id: number, admin: boolean) => ['training', 'card', id, admin] as const,
  groups: (query: GroupQuery) => ['training', 'groups', query] as const,
  group: (id: number) => ['training', 'group', id] as const,
  sessions: (id: number) => ['training', 'sessions', id] as const,
  board: (id: number) => ['training', 'board', id] as const,
  norms: (admin: boolean, stage?: TrainingStage) => ['training', 'norms', admin, stage ?? null] as const,
  athlete: (id: string, part: 'enrollments' | 'attendance' | 'history') =>
    ['training', 'athlete', id, part] as const,
}

export function useOrganizationCard(id: number | null, admin: boolean) {
  return useQuery({
    queryKey: trainingKeys.card(id ?? 0, admin),
    queryFn: ({ signal }) => trainingApi.card(id!, admin, signal),
    enabled: id !== null,
  })
}

export function useTrainingGroups(query: GroupQuery, enabled = true) {
  return useQuery({
    queryKey: trainingKeys.groups(query),
    queryFn: ({ signal }) => trainingApi.groups(query, signal),
    enabled,
  })
}

export function useTrainingGroup(id: number) {
  return useQuery({
    queryKey: trainingKeys.group(id),
    queryFn: ({ signal }) => trainingApi.group(id, signal),
  })
}

export function useGroupSessions(id: number) {
  return useQuery({
    queryKey: trainingKeys.sessions(id),
    queryFn: ({ signal }) => trainingApi.sessions(id, signal),
  })
}

export function useAttestationBoard(id: number, enabled = true) {
  return useQuery({
    queryKey: trainingKeys.board(id),
    queryFn: ({ signal }) => trainingApi.board(id, signal),
    enabled,
  })
}

export function useNorms(admin: boolean, stage?: TrainingStage) {
  return useQuery({
    queryKey: trainingKeys.norms(admin, stage),
    queryFn: ({ signal }) => trainingApi.norms(admin, stage, signal),
    staleTime: 60_000,
  })
}

export function useAthleteEnrollments(id: string | null) {
  return useQuery({
    queryKey: trainingKeys.athlete(id ?? '', 'enrollments'),
    queryFn: ({ signal }) => trainingApi.enrollments(id!, signal),
    enabled: Boolean(id),
  })
}

export function useAthleteAttendance(id: string | null) {
  return useQuery({
    queryKey: trainingKeys.athlete(id ?? '', 'attendance'),
    queryFn: ({ signal }) => trainingApi.attendance(id!, signal),
    enabled: Boolean(id),
  })
}

export function useNormHistory(id: string | null) {
  return useQuery({
    queryKey: trainingKeys.athlete(id ?? '', 'history'),
    queryFn: ({ signal }) => trainingApi.history(id!, signal),
    enabled: Boolean(id),
  })
}
