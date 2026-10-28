import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { sessionApi, sessionKeys } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { isEmailLike, useCountdown } from '@/shared/lib'
import { Button, CodeForm, Field, FormAlert, Input, Modal, PasswordInput, showToast } from '@/shared/ui'

/**
 * Смена почты в два шага: новый адрес и пароль → код, который пришёл на новый адрес.
 * Черновик живёт до закрытия; страница меняет key на каждое открытие.
 */
export function EmailChangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const client = useQueryClient()
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [left, restart] = useCountdown()
  const request = useMutation({
    mutationFn: sessionApi.changeEmail,
    onSuccess: () => {
      restart()
      setStep('code')
    },
  })
  const confirm = useMutation({
    mutationFn: sessionApi.confirmEmailChange,
    onSuccess: () => {
      showToast('Почта изменена', { tone: 'success', description: email.trim() })
      void client.invalidateQueries({ queryKey: sessionKeys.me })
      onClose()
    },
  })
  const requestError = request.error instanceof ApiError ? request.error : null
  const confirmError =
    confirm.error instanceof ApiError ? (confirm.error.field('code') ?? confirm.error.message) : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!isEmailLike(email) || !password) return
    request.mutate({ new_email: email.trim(), password })
  }

  return (
    <Modal
      size="md"
      open={open}
      onClose={onClose}
      onSubmit={step === 'form' ? submit : undefined}
      title="Новая почта"
      description={step === 'form' ? 'Код подтверждения придёт на новый адрес' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={step === 'code' ? () => setStep('form') : onClose}>
            {step === 'code' ? 'Назад' : 'Отмена'}
          </Button>
          {step === 'form' && (
            <Button type="submit" loading={request.isPending}>
              Получить код
            </Button>
          )}
        </>
      }
    >
      {step === 'form' ? (
        <div className="flex flex-col gap-5">
          {requestError && !Object.keys(requestError.fields ?? {}).length && (
            <FormAlert>{requestError.message}</FormAlert>
          )}
          <Field
            label="Новая почта"
            error={
              (touched && !isEmailLike(email) ? 'Проверьте адрес почты' : undefined) ??
              requestError?.field('new_email')
            }
          >
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
          <Field
            label="Текущий пароль"
            error={(touched && !password ? 'Введите пароль' : undefined) ?? requestError?.field('password')}
          >
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <CodeForm
            email={email.trim()}
            submitLabel="Сменить почту"
            onSubmit={(code) => confirm.mutate(code)}
            pending={confirm.isPending}
            error={confirmError}
            onResend={() => request.mutate({ new_email: email.trim(), password })}
            resendPending={request.isPending}
            resendIn={left}
          />
          <FormAlert tone="info">
            После смены почты все входы на других устройствах завершатся. На старый адрес придёт
            предупреждение.
          </FormAlert>
        </div>
      )}
    </Modal>
  )
}
