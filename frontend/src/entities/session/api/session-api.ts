import { ApiError, request } from '@/shared/api'
import type {
  CodeforcesInfo,
  LoginInput,
  Me,
  ProfileInput,
  RegisterInput,
  ResetPasswordInput,
  User,
} from '../model/types'

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
  saveCodeforces: (handle: string) =>
    request<CodeforcesInfo>('/me/codeforces', { method: 'PUT', body: { handle } }),
  removeCodeforces: () => request<void>('/me/codeforces', { method: 'DELETE' }),
  updateProfile: (body: ProfileInput) => request<Me>('/me', { method: 'PATCH', body }),
  setAcademicGroup: (academic_group_id: number | null) =>
    request<Me>('/me', { method: 'PATCH', body: { academic_group_id } }),
  forgotPassword: (email: string) =>
    request<void>('/auth/password/forgot', { method: 'POST', body: { email } }),
  verifyResetCode: (body: { email: string; code: string }) =>
    request<{ reset_token: string }>('/auth/password/verify', { method: 'POST', body }),
  sendEmailCode: () => request<void>('/me/email/verify/send', { method: 'POST' }),
  verifyEmail: (code: string) => request<void>('/me/email/verify', { method: 'POST', body: { code } }),
  changeEmail: (body: { new_email: string; password: string }) =>
    request<void>('/me/email/change', { method: 'POST', body }),
  confirmEmailChange: (code: string) =>
    request<void>('/me/email/change/confirm', { method: 'POST', body: { code } }),
  resetPassword: (body: ResetPasswordInput) =>
    request<void>('/auth/password/reset', { method: 'POST', body }),
}
