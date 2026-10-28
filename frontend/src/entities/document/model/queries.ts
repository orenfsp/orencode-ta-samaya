import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { documentApi } from '../api/document-api'
import type { DocumentKind } from './types'

export const documentKeys = {
  all: ['documents'] as const,
  contest: (contestId: number) => ['documents', 'contest', contestId] as const,
  verify: (token: string) => ['documents', 'verify', token] as const,
  mine: ['documents', 'mine'] as const,
}

export function useContestDocuments(contestId: number) {
  return useQuery({
    queryKey: documentKeys.contest(contestId),
    queryFn: ({ signal }) => documentApi.contest(contestId, signal),
    select: (page) => page.items,
    enabled: contestId > 0,
  })
}

export function useVerifiedDocument(token: string) {
  return useQuery({
    queryKey: documentKeys.verify(token),
    queryFn: ({ signal }) => documentApi.verify(token, signal),
    enabled: token.length > 0,
    retry: false,
  })
}

/** Свои документы: порядок по дате выдачи, фильтр по виду — на сервере. Прошлый список не мигает */
export function useMyDocuments(query: { sort?: 'new' | 'old'; kind?: DocumentKind } = {}) {
  return useQuery({
    queryKey: [...documentKeys.mine, query],
    queryFn: ({ signal }) => documentApi.mine(query, signal),
    placeholderData: keepPreviousData,
  })
}
