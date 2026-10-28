import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { consentApi } from '../api/consent-api'
import type { ConsentStatus } from './types'

export const consentKeys = {
  all: ['consents'] as const,
  mine: ['consents', 'mine'] as const,
  count: ['consents', 'count'] as const,
  queue: (filters: object, limit: number, offset: number) =>
    ['consents', 'queue', filters, limit, offset] as const,
}

export function useMyConsent() {
  return useQuery({ queryKey: consentKeys.mine, queryFn: ({ signal }) => consentApi.mine(signal) })
}

export function useConsentCount(enabled = true) {
  return useQuery({ queryKey: consentKeys.count, queryFn: ({ signal }) => consentApi.count(signal), enabled })
}

export function useConsentQueue(
  filters: { status?: ConsentStatus; search?: string },
  limit: number,
  offset: number,
  enabled = true,
) {
  return useQuery({
    queryKey: consentKeys.queue(filters, limit, offset),
    queryFn: ({ signal }) => consentApi.queue(filters, limit, offset, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}
