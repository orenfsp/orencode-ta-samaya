import { fileUrl, request } from '@/shared/api'
import type { PageInput, Person, PostInput, WallEntry, WallRole } from '../model/types'

/** Фото человека по id: бэк переадресует на файл, нет фото — 404 и инициалы */
export const personAvatar = (id: string) => fileUrl(`/people/${id}/avatar`)

export const personApi = {
  get: (id: string, signal?: AbortSignal) => request<Person>(`/people/${id}`, { signal }),
  wall: (id: string, role: WallRole, limit: number, offset: number, signal?: AbortSignal) =>
    request<{ items: WallEntry[]; total: number }>(`/people/${id}/wall`, {
      query: { role, limit, offset },
      signal,
    }),
  updatePage: (body: PageInput) => request<Person>('/me/page', { method: 'PATCH', body }),
  savePost: (role: WallRole, contestId: number, body: PostInput) =>
    request<{ id: string }>(`/me/wall/${role}/${contestId}`, { method: 'PUT', body }),
  moderatePost: (id: string, hidden: boolean) =>
    request<{ id: string }>(`/admin/wall-posts/${id}`, {
      method: 'PATCH',
      body: { hidden_by_federation: hidden },
    }),
}
