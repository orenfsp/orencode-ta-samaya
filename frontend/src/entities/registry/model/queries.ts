import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { registryApi } from '../api/registry-api'
import type { HeadcountCut, RegistryQuery } from './types'

export function useRegistryAthletes(query: RegistryQuery) {
  return useQuery({
    queryKey: ['registry', 'athletes', query],
    queryFn: ({ signal }) => registryApi.athletes(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function useRegistryCoaches(query: RegistryQuery) {
  return useQuery({
    queryKey: ['registry', 'coaches', query],
    queryFn: ({ signal }) => registryApi.coaches(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function useRegistryJudges(query: RegistryQuery) {
  return useQuery({
    queryKey: ['registry', 'judges', query],
    queryFn: ({ signal }) => registryApi.judges(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function useHeadcount(cut: HeadcountCut, from: number, to: number) {
  return useQuery({
    queryKey: ['registry', 'headcount', cut, from, to],
    queryFn: ({ signal }) => registryApi.headcount(cut, from, to, signal),
    placeholderData: keepPreviousData,
  })
}
