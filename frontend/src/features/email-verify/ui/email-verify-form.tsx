import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { sessionApi, sessionKeys } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { useCountdown } from '@/shared/lib'
import { CodeForm, showToast } from '@/shared/ui'

/**
 * Подтверждение почты кодом — одна форма для шага регистрации, окна из кабинета и настроек.
 * Код уходит при регистрации; повторная отправка — через минуту.
 */
export function EmailVerifyForm({
  email,
  title = 'Подтвердите почту',
  onDone,
  secondary,
}: {
  email: string
  title?: string
  onDone?: () => void
  secondary?: ReactNode
}) {
  const client = useQueryClient()
  const [left, restart] = useCountdown()
  const send = useMutation({
    mutationFn: sessionApi.sendEmailCode,
    onSuccess: () => {
      restart()
      showToast('Код отправлен', { tone: 'success', description: email })
    },
    onError: (error) => showToast('Не удалось отправить код', { tone: 'danger', description: error.message }),
  })
  const verify = useMutation({
    mutationFn: sessionApi.verifyEmail,
    onSuccess: async () => {
      showToast('Почта подтверждена', { tone: 'success' })
      await client.invalidateQueries({ queryKey: sessionKeys.me })
      onDone?.()
    },
  })
  const error =
    verify.error instanceof ApiError ? (verify.error.field('code') ?? verify.error.message) : undefined

  return (
    <CodeForm
      title={title}
      email={email}
      hint="Без подтверждения письма о решениях по заявкам и ролям не приходят"
      onSubmit={(code) => verify.mutate(code)}
      pending={verify.isPending}
      error={error}
      onResend={() => send.mutate()}
      resendPending={send.isPending}
      resendIn={left}
      secondary={secondary}
    />
  )
}
