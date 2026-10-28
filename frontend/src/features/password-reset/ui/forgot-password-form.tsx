import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { sessionApi } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { isEmailLike, useCountdown } from '@/shared/lib'
import { Button, CodeForm, Field, FormAlert, IconArrowRight, Input } from '@/shared/ui'
import { ResetPasswordForm } from './reset-password-form'

/**
 * Восстановление доступа кодом из письма: почта → код → новый пароль.
 * Бэк на запрос кода всегда отвечает 202 и не говорит, есть ли аккаунт, поэтому шаг кода
 * говорит «если аккаунт есть».
 */
export function ForgotPasswordForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [token, setToken] = useState('')
  const [left, restart] = useCountdown()
  const forgot = useMutation({ mutationFn: sessionApi.forgotPassword, onSuccess: restart })
  const verify = useMutation({
    mutationFn: sessionApi.verifyResetCode,
    onSuccess: (data) => {
      setToken(data.reset_token)
      setStep('password')
    },
  })

  const emailError = touched && !isEmailLike(email) ? 'Проверьте адрес почты' : undefined
  const codeError =
    verify.error instanceof ApiError ? (verify.error.field('code') ?? verify.error.message) : undefined

  const sendCode = (event?: FormEvent) => {
    event?.preventDefault()
    setTouched(true)
    if (!isEmailLike(email)) return
    forgot.mutate(email.trim(), { onSuccess: () => setStep('code') })
  }

  const counter = (
    <p className="font-mono text-sm text-muted">Шаг {step === 'email' ? 1 : step === 'code' ? 2 : 3} из 3</p>
  )

  if (step === 'password')
    return (
      <div className="flex flex-col gap-3">
        {counter}
        <ResetPasswordForm token={token} onSuccess={onDone} onExpired={() => setStep('email')} />
      </div>
    )

  if (step === 'code')
    return (
      <div className="flex flex-col gap-6">
        {counter}
        <CodeForm
          title="Код из письма"
          email={email.trim()}
          hint="Код придёт, если аккаунт с этим адресом есть. Он действует 15 минут"
          submitLabel="Продолжить"
          onSubmit={(value) => verify.mutate({ email: email.trim(), code: value })}
          pending={verify.isPending}
          error={codeError}
          onResend={() => forgot.mutate(email.trim())}
          resendPending={forgot.isPending}
          resendIn={left}
          secondary={
            <Button variant="ghost" onClick={() => setStep('email')}>
              Другая почта
            </Button>
          }
        />
      </div>
    )

  return (
    <form onSubmit={sendCode} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {counter}
        <h1 className="text-h2 font-medium">Восстановление</h1>
        <p className="text-body text-muted">Пришлём на почту код для нового пароля</p>
      </div>

      {forgot.isError && <FormAlert>{forgot.error.message}</FormAlert>}

      <Field label="Почта" error={emailError}>
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
        Получить код
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
