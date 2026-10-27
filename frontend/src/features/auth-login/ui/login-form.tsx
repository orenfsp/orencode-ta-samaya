import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { sessionApi, sessionKeys } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { plural } from '@/shared/lib'
import { Button, Field, FormAlert, Input, PasswordInput } from '@/shared/ui'

function loginErrorText(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Не получилось связаться с сервером. Проверьте интернет и попробуйте ещё раз'
  if (error.status === 429 && error.retryAfter) {
    const minutes = Math.ceil(error.retryAfter / 60)
    return `Слишком много попыток. Попробуйте через ${minutes} ${plural(minutes, ['минуту', 'минуты', 'минут'])}`
  }
  return error.message
}

/** Вход по почте и паролю. После успеха сессия уже в cookie — обновляем кеш пользователя и отдаём управление странице */
export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const client = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  const login = useMutation({
    mutationFn: sessionApi.login,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: sessionKeys.me })
      onSuccess()
    },
  })

  const errors = {
    email: touched && !email.trim() ? 'Введите почту' : undefined,
    password: touched && !password ? 'Введите пароль' : undefined,
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!email.trim() || !password) return
    login.mutate({ email: email.trim(), password })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h1 className="mb-2 text-h2 font-medium">Вход</h1>

      {login.isError && <FormAlert>{loginErrorText(login.error)}</FormAlert>}

      <Field label="Почта" error={errors.email}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.ru"
        />
      </Field>

      <Field
        label="Пароль"
        error={errors.password}
        labelEnd={
          <Link
            to={routes.forgotPassword}
            className="text-sm text-muted underline decoration-line underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink"
          >
            Забыли пароль?
          </Link>
        }
      >
        <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>

      <Button type="submit" size="lg" fullWidth loading={login.isPending} className="mt-2">
        Войти
      </Button>

      <p className="text-center text-body text-muted">
        Нет аккаунта?{' '}
        <Link
          to={routes.register}
          className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Зарегистрироваться
        </Link>
      </p>
    </form>
  )
}
