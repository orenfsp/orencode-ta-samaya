import type { SelfRole } from '@/entities/session'
import { isEmailLike, isPasswordValid } from '@/shared/lib'

export interface RegisterDraft {
  email: string
  password: string
  passwordRepeat: string
  lastName: string
  firstName: string
  middleName: string
  birthDate: string
  roles: SelfRole[]
  consent: boolean
}

export const emptyDraft: RegisterDraft = {
  email: '',
  password: '',
  passwordRepeat: '',
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  roles: [],
  consent: false,
}

export type DraftErrors = Partial<Record<keyof RegisterDraft, string>>

export const steps = [
  { id: 'email', title: 'Почта', fields: ['email'] },
  { id: 'password', title: 'Пароль', fields: ['password', 'passwordRepeat'] },
  { id: 'person', title: 'О себе', fields: ['lastName', 'firstName', 'middleName', 'birthDate'] },
  { id: 'roles', title: 'Роли', fields: ['roles'] },
  { id: 'consent', title: 'Согласие', fields: ['consent'] },
] as const satisfies readonly { id: string; title: string; fields: readonly (keyof RegisterDraft)[] }[]

const today = () => new Date().toISOString().slice(0, 10)

/** Проверки шага на клиенте — те же, что у бэка (docs/api_map.md, RegisterIn), чтобы не гонять заведомо плохой запрос */
export function validateStep(index: number, draft: RegisterDraft): DraftErrors {
  const errors: DraftErrors = {}
  const name = (value: string) => value.trim().length >= 1 && value.trim().length <= 100
  switch (steps[index]?.id) {
    case 'email':
      if (!isEmailLike(draft.email)) errors.email = 'Проверьте адрес почты'
      break
    case 'password':
      if (!isPasswordValid(draft.password)) errors.password = 'Пароль не подходит под правила'
      if (draft.passwordRepeat !== draft.password) errors.passwordRepeat = 'Пароли не совпадают'
      break
    case 'person':
      if (!name(draft.lastName)) errors.lastName = 'Укажите фамилию'
      if (!name(draft.firstName)) errors.firstName = 'Укажите имя'
      if (draft.middleName.trim().length > 100) errors.middleName = 'Не длиннее 100 символов'
      if (!draft.birthDate) errors.birthDate = 'Укажите дату рождения'
      else if (draft.birthDate < '1900-01-01' || draft.birthDate > today())
        errors.birthDate = 'Проверьте дату'
      break
    case 'roles':
      if (!draft.roles.length) errors.roles = 'Выберите хотя бы одну роль'
      break
    case 'consent':
      if (!draft.consent) errors.consent = 'Без согласия зарегистрироваться нельзя'
      break
  }
  return errors
}

/** Имена полей бэка → поля черновика: ошибку сервера показываем на том шаге, где поле */
export const serverFieldMap: Record<string, keyof RegisterDraft> = {
  email: 'email',
  password: 'password',
  password_repeat: 'passwordRepeat',
  last_name: 'lastName',
  first_name: 'firstName',
  middle_name: 'middleName',
  birth_date: 'birthDate',
  roles: 'roles',
  pd_consent: 'consent',
}

export const stepOfField = (field: keyof RegisterDraft) =>
  steps.findIndex((step) => (step.fields as readonly string[]).includes(field))

export function ageOn(birthDate: string, on = new Date()) {
  const birth = new Date(birthDate)
  let age = on.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    on.getMonth() < birth.getMonth() || (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
}

export const maxBirthDate = today
