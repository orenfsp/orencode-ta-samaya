import { useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { Button } from './button'
import { CodeInput } from './code-input'

/**
 * Ввод кода из письма — один экран на всю платформу: подтверждение почты после регистрации и в кабинете,
 * восстановление пароля, смена почты. По центру: куда отправили, крупные ячейки, ошибка под ними,
 * кнопка и повторная отправка с таймером. Запросы — у обёртки, здесь только вид.
 */
export function CodeForm({
  title,
  email,
  hint,
  onSubmit,
  pending,
  error,
  onResend,
  resendPending,
  resendIn = 0,
  submitLabel = 'Подтвердить',
  secondary,
  autoFocus = true,
  className,
}: {
  title?: ReactNode
  /** Куда ушёл код */
  email: string
  /** Строка под адресом: зачем подтверждать */
  hint?: ReactNode
  onSubmit: (code: string) => void
  pending?: boolean
  error?: string
  onResend?: () => void
  resendPending?: boolean
  /** Секунд до повторной отправки; 0 — можно сейчас */
  resendIn?: number
  submitLabel?: string
  /** «Позже», «Другая почта» */
  secondary?: ReactNode
  autoFocus?: boolean
  className?: string
}) {
  const [code, setCode] = useState('')
  const [shown, setShown] = useState(error)
  // Новая ошибка с сервера — ячейки очищаются для нового ввода
  if (error !== shown) {
    setShown(error)
    if (error) setCode('')
  }
  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (code.length === 6 && !pending) onSubmit(code)
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn('flex flex-col items-center gap-6 text-center', className)}
    >
      <div className="flex flex-col items-center gap-2">
        {title && <h2 className="text-h2 font-medium text-balance">{title}</h2>}
        <p className="text-body text-muted">
          Отправили код из 6 цифр на <span className="break-all text-ink">{email}</span>
        </p>
        {hint && <p className="max-w-md text-sm text-muted">{hint}</p>}
      </div>
      <div className="flex flex-col items-center gap-2">
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={(value) => !pending && onSubmit(value)}
          size="lg"
          autoFocus={autoFocus}
          disabled={pending}
          className={cn(error && '[&_input]:field-invalid')}
        />
        <p role="alert" className={cn('min-h-5 text-sm text-danger-text', !error && 'invisible')}>
          {error ?? ' '}
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button type="submit" size="lg" fullWidth loading={pending} disabled={code.length !== 6}>
          {submitLabel}
        </Button>
        {onResend && (
          <Button variant="text" disabled={resendIn > 0} loading={resendPending} onClick={onResend}>
            {resendIn > 0 ? `Отправить ещё раз через ${resendIn} с` : 'Отправить код ещё раз'}
          </Button>
        )}
        {secondary}
      </div>
    </form>
  )
}
