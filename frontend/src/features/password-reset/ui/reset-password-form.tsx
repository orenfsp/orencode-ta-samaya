import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { sessionApi } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { isPasswordValid } from '@/shared/lib'
import { Button, Field, FormAlert, PasswordInput, PasswordRules } from '@/shared/ui'

/** Новый пароль по токену после проверки кода. Бэк закрывает все сессии — после успеха человек входит заново */
export function ResetPasswordForm({
  token,
  onSuccess,
  onExpired,
}: {
  token: string
  onSuccess: () => void
  onExpired: () => void
}) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [touched, setTouched] = useState(false)
  const reset = useMutation({ mutationFn: sessionApi.resetPassword, onSuccess })

  const serverError = reset.error instanceof ApiError ? reset.error : null
  const tokenInvalid = serverError?.code === 'invalid_token'

  const errors = {
    password:
      (touched && !isPasswordValid(password) ? 'Пароль не подходит под правила' : undefined) ??
      serverError?.field('password'),
    repeat:
      (touched && repeat !== password ? 'Пароли не совпадают' : undefined) ??
      serverError?.field('password_repeat'),
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!isPasswordValid(password) || repeat !== password) return
    reset.mutate({ token, password, password_repeat: repeat })
  }

  if (tokenInvalid) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-h2 font-medium">Время вышло</h1>
        <FormAlert>На новый пароль даётся 10 минут после ввода кода. Запросите код ещё раз.</FormAlert>
        <Button size="lg" fullWidth onClick={onExpired}>
          Запросить новый код
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="mb-2 text-h2 font-medium">Новый пароль</h1>

      {reset.isError && !Object.keys(serverError?.fields ?? {}).length && (
        <FormAlert>{reset.error.message}</FormAlert>
      )}

      <Field label="Новый пароль" error={errors.password}>
        <PasswordInput
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <PasswordRules value={password} className="-mt-2" />
      <Field label="Повторите пароль" error={errors.repeat}>
        <PasswordInput
          autoComplete="new-password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={reset.isPending}>
        Сохранить пароль
      </Button>
    </form>
  )
}
