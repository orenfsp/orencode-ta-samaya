import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sessionApi } from '../api/session-api'

export const sessionKeys = { me: ['session', 'me'] as const }

/** Текущий пользователь или null для гостя. Один запрос на всё приложение — кеш React Query */
export function useMe() {
  return useQuery({ queryKey: sessionKeys.me, queryFn: sessionApi.me, staleTime: 60_000 })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: sessionApi.logout,
    onSuccess: () => {
      client.setQueryData(sessionKeys.me, null)
      // Данные кабинетов принадлежали прошлому пользователю
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    },
  })
}

/** Академическая группа: нужна для заявок, после сохранения обновляем /me на месте */
export function useSetAcademicGroup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: sessionApi.setAcademicGroup,
    onSuccess: (me) => client.setQueryData(sessionKeys.me, me),
  })
}

/** ФИО, дата рождения и группа аккаунта: общие для всех ролей. После сохранения обновляем /me на месте */
export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: sessionApi.updateProfile,
    onSuccess: (me) => client.setQueryData(sessionKeys.me, me),
  })
}
