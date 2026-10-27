import { ApiError, request } from '@/shared/api'
import type { LoginInput, Me, RegisterInput, ResetPasswordInput, User } from '../model/types'

export const sessionApi = {
  /** Нет сессии — не ошибка, а гость: null вместо исключения */
  async me(): Promise<Me | null> {
    try {
      return await request<Me>('/me')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  login: (body: LoginInput) => request<User>('/auth/login', { method: 'POST', body }),
  register: (body: RegisterInput) => request<User>('/auth/register', { method: 'POST', body }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  setAcademicGroup: (academic_group_id: number | null) =>
    request<Me>('/me', { method: 'PATCH', body: { academic_group_id } }),
  forgotPassword: (email: string) =>
    request<void>('/auth/password/forgot', { method: 'POST', body: { email } }),
  resetPassword: (body: ResetPasswordInput) =>
    request<void>('/auth/password/reset', { method: 'POST', body }),
}
