import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/shared/api'
import { newsApi } from '../api/news-api'

export const newsKeys = {
  all: ['news'] as const,
  list: (query: object) => ['news', 'list', query] as const,
  tags: ['news', 'tags'] as const,
  article: (slug: string) => ['news', 'article', slug] as const,
  admin: (query: object) => ['news', 'admin', query] as const,
  adminArticle: (id: string) => ['news', 'admin', 'article', id] as const,
}

const notFound = (error: Error) => error instanceof ApiError && error.status === 404

/** Лента опубликованных: «Показать ещё» увеличивает limit, прошлые карточки не мигают */
export const useNews = (filters: { q?: string; tag?: string; section?: string }, limit: number) =>
  useQuery({
    queryKey: newsKeys.list({ ...filters, limit }),
    queryFn: () => newsApi.list({ ...filters, limit }),
    placeholderData: keepPreviousData,
  })

export const useNewsTags = () =>
  useQuery({ queryKey: newsKeys.tags, queryFn: newsApi.tags, staleTime: 60_000 })

export const useArticle = (slug: string) =>
  useQuery({
    queryKey: newsKeys.article(slug),
    queryFn: () => newsApi.detail(slug),
    retry: (count, error) => !notFound(error) && count < 2,
  })

export const useAdminNews = (filters: { q?: string; status?: string; tag?: string }, limit: number) =>
  useQuery({
    queryKey: newsKeys.admin({ ...filters, limit }),
    queryFn: () => newsApi.adminList({ ...filters, limit }),
    placeholderData: keepPreviousData,
  })

export const useAdminArticle = (id: string | undefined) =>
  useQuery({
    queryKey: newsKeys.adminArticle(id ?? ''),
    queryFn: () => newsApi.adminDetail(id!),
    enabled: Boolean(id),
    retry: (count, error) => !notFound(error) && count < 2,
  })
