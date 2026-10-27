/** Правило пароля из docs/api_map.md: те же проверки, что на бэке, чтобы человек видел их до отправки */
export const passwordRules = [
  { id: 'length', label: 'от 8 символов', test: (value: string) => value.length >= 8 && value.length <= 128 },
  { id: 'lower', label: 'строчная буква', test: (value: string) => /\p{Ll}/u.test(value) },
  { id: 'upper', label: 'заглавная буква', test: (value: string) => /\p{Lu}/u.test(value) },
  { id: 'digit', label: 'цифра', test: (value: string) => /\d/.test(value) },
] as const

export const isPasswordValid = (value: string) => passwordRules.every((rule) => rule.test(value))

/** Без претензии на RFC: точную проверку делает бэк, здесь — только явные опечатки */
export const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
