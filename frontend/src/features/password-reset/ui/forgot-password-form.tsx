import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { sessionApi } from '@/entities/session'
import { routes } from '@/shared/config'
import { isEmailLike } from '@/shared/lib'
import { Button, Field, FormAlert, IconArrowRight, IconCheckCircle, Input } from '@/shared/ui'

/**
 * Запрос ссылки на сброс. Бэк всегда отвечает 202 и не говорит, есть ли такой адрес, —
 * поэтому и экран успеха говорит «если аккаунт есть», а не «письмо отправлено».
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const forgot = useMutation({ mutationFn: sessionApi.forgotPassword })

  const error = touched && !isEmailLike(email) ? 'Проверьте адрес почты' : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!isEmailLike(email)) return
    forgot.mutate(email.trim())
  }

  if (forgot.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <span className="grid size-14 animate-pop-in place-items-center rounded-full bg-primary text-white">
          <IconCheckCircle size={28} />
        </span>
        <h1 className="text-h2 font-medium">Проверьте почту</h1>
        <p className="text-body text-muted">
          Если аккаунт с адресом <span className="text-ink">{email.trim()}</span> есть, мы отправили на него
          ссылку для нового пароля. Она действует один час.
        </p>
        <Button to={routes.login} variant="secondary" size="lg" fullWidth>
          Вернуться ко входу
        </Button>
        <button
          type="button"
          onClick={() => forgot.reset()}
          className="self-center text-body text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Отправить на другой адрес
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-medium">Восстановление</h1>
        <p className="text-body text-muted">Пришлём на почту ссылку для нового пароля</p>
      </div>

      {forgot.isError && <FormAlert>{forgot.error.message}</FormAlert>}

      <Field label="Почта" error={error}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.ru"
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={forgot.isPending}
        rightIcon={<IconArrowRight size={18} />}
      >
        Получить ссылку
      </Button>

      <p className="text-center text-body text-muted">
        Вспомнили?{' '}
        <Link
          to={routes.login}
          className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Войти
        </Link>
      </p>
    </form>
  )
}
