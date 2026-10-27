import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { sessionApi, sessionKeys, type User } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import {
  Button,
  Checkbox,
  DateInput,
  Field,
  FormAlert,
  IconArrowRight,
  IconChevronLeft,
  Input,
  PasswordInput,
  PasswordRules,
} from '@/shared/ui'
import {
  ageOn,
  emptyDraft,
  maxBirthDate,
  serverFieldMap,
  stepOfField,
  steps,
  validateStep,
  type DraftErrors,
  type RegisterDraft,
} from '../model/register-draft'
import { RolePicker } from './role-picker'

// Короткий заголовок шага и пояснение только там, где оно что-то добавляет
const stepIntro: Record<(typeof steps)[number]['id'], { title: string; text?: string }> = {
  email: { title: 'Регистрация', text: 'Почта станет логином для входа' },
  password: { title: 'Пароль' },
  person: { title: 'Ваши данные' },
  roles: { title: 'Роли', text: 'Можно несколько. Новую роль можно запросить и позже, в кабинете' },
  consent: { title: 'Проверьте данные' },
}

/**
 * Регистрация по шагам, как у Google: на экране одна мысль, Enter ведёт дальше, «Назад» ничего не теряет.
 * Проверки шага — на клиенте; ошибки бэка раскладываются по полям и возвращают на шаг с ошибкой.
 */
export function RegisterWizard({ onSuccess }: { onSuccess: (user: User) => void }) {
  const client = useQueryClient()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [draft, setDraft] = useState<RegisterDraft>(emptyDraft)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [emailTaken, setEmailTaken] = useState(false)

  const register = useMutation({
    mutationFn: sessionApi.register,
    onSuccess: async (user) => {
      await client.invalidateQueries({ queryKey: sessionKeys.me })
      onSuccess(user)
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return
      if (error.code === 'email_taken') {
        setEmailTaken(true)
        go(stepOfField('email'))
        return
      }
      const fieldErrors: DraftErrors = {}
      for (const [serverField, messages] of Object.entries(error.fields)) {
        const field = serverFieldMap[serverField]
        if (field && messages[0]) fieldErrors[field] = messages[0]
      }
      setErrors(fieldErrors)
      const firstStep = Math.min(
        ...Object.keys(fieldErrors).map((field) => stepOfField(field as keyof RegisterDraft)),
      )
      if (Number.isFinite(firstStep)) go(firstStep)
    },
  })

  const update = <K extends keyof RegisterDraft>(key: K, value: RegisterDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    // Поле поправили — старая ошибка больше не про него
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (key === 'email') setEmailTaken(false)
  }

  const go = (next: number) => {
    setDirection(next > step ? 'forward' : 'back')
    setStep(next)
  }

  const submitStep = (event: FormEvent) => {
    event.preventDefault()
    const stepErrors = validateStep(step, draft)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length) return
    if (step < steps.length - 1) return go(step + 1)
    register.mutate({
      email: draft.email.trim(),
      password: draft.password,
      password_repeat: draft.passwordRepeat,
      last_name: draft.lastName.trim(),
      first_name: draft.firstName.trim(),
      middle_name: draft.middleName.trim() || null,
      birth_date: draft.birthDate,
      roles: draft.roles,
      pd_consent: true,
    })
  }

  const current = steps[step]!
  const intro = stepIntro[current.id]
  const isLast = step === steps.length - 1
  const isMinor = draft.birthDate && ageOn(draft.birthDate) < 18

  return (
    <form onSubmit={submitStep} noValidate className="flex flex-col gap-7">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          aria-label="Назад"
          className="-ml-2 grid size-9 shrink-0 pressable place-items-center rounded-sm text-ink transition-opacity hover:bg-hover-tint disabled:pointer-events-none disabled:opacity-0"
        >
          <IconChevronLeft size={18} />
        </button>
        {/* Одна тонкая линия прогресса: заполняется плавно, без пяти отдельных полосок */}
        <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <span
            className="absolute inset-0 origin-left bg-primary transition-[scale] duration-500 ease-emphasized"
            style={{ scale: `${(step + 1) / steps.length} 1` }}
          />
        </span>
        <span className="shrink-0 font-mono text-sm text-muted tabular-nums">
          {String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
        </span>
      </div>

      {/* key по шагу: каждый шаг монтируется заново и въезжает со стороны движения */}
      <div
        key={current.id}
        className={cn(
          'flex flex-col gap-5',
          direction === 'forward' ? 'animate-step-forward' : 'animate-step-back',
        )}
      >
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h2 font-medium">{intro.title}</h1>
          {intro.text && <p className="text-body text-muted">{intro.text}</p>}
        </div>

        {current.id === 'email' && (
          <>
            {emailTaken && (
              <FormAlert>
                Аккаунт с этой почтой уже есть.{' '}
                <Link to={routes.login} className="underline underline-offset-4">
                  Войти
                </Link>{' '}
                или{' '}
                <Link to={routes.forgotPassword} className="underline underline-offset-4">
                  восстановить пароль
                </Link>
              </FormAlert>
            )}
            <Field label="Почта" error={errors.email}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={draft.email}
                onChange={(event) => update('email', event.target.value)}
                placeholder="name@example.ru"
              />
            </Field>
          </>
        )}

        {current.id === 'password' && (
          <>
            <Field label="Пароль" error={errors.password}>
              <PasswordInput
                autoComplete="new-password"
                autoFocus
                value={draft.password}
                onChange={(event) => update('password', event.target.value)}
              />
            </Field>
            <PasswordRules value={draft.password} className="-mt-2" />
            <Field label="Повторите пароль" error={errors.passwordRepeat}>
              <PasswordInput
                autoComplete="new-password"
                value={draft.passwordRepeat}
                onChange={(event) => update('passwordRepeat', event.target.value)}
              />
            </Field>
          </>
        )}

        {current.id === 'person' && (
          <>
            <Field label="Фамилия" required error={errors.lastName}>
              <Input
                autoComplete="family-name"
                autoFocus
                value={draft.lastName}
                onChange={(event) => update('lastName', event.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Имя" required error={errors.firstName}>
                <Input
                  autoComplete="given-name"
                  value={draft.firstName}
                  onChange={(event) => update('firstName', event.target.value)}
                />
              </Field>
              <Field label="Отчество" hint="Если есть" error={errors.middleName}>
                <Input
                  autoComplete="additional-name"
                  value={draft.middleName}
                  onChange={(event) => update('middleName', event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Дата рождения"
              required
              error={errors.birthDate}
              hint={
                isMinor ? 'Для участия в соревнованиях понадобится согласие родителя или опекуна' : undefined
              }
            >
              <DateInput
                autoComplete="bday"
                min="1900-01-01"
                max={maxBirthDate()}
                value={draft.birthDate}
                onChange={(value) => update('birthDate', value)}
              />
            </Field>
          </>
        )}

        {current.id === 'roles' && (
          <>
            <RolePicker
              value={draft.roles}
              onChange={(roles) => update('roles', roles)}
              invalid={Boolean(errors.roles)}
            />
            {errors.roles && (
              <p role="alert" className="-mt-2 text-sm text-danger-text">
                {errors.roles}
              </p>
            )}
          </>
        )}

        {current.id === 'consent' && (
          <>
            <dl className="grid gap-3 card p-5 text-body">
              {[
                ['Почта', draft.email.trim()],
                [
                  'ФИО',
                  [draft.lastName, draft.firstName, draft.middleName]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(' '),
                ],
                ['Дата рождения', new Date(draft.birthDate).toLocaleDateString('ru-RU')],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <Checkbox
              checked={draft.consent}
              onChange={(event) => update('consent', event.target.checked)}
              aria-invalid={Boolean(errors.consent) || undefined}
              label={
                <>
                  Согласен на{' '}
                  <Link
                    to={routes.personalData}
                    target="_blank"
                    className="underline decoration-line underline-offset-4 hover:decoration-ink"
                  >
                    обработку персональных данных
                  </Link>
                </>
              }
              description="Откроется в новой вкладке, введённое здесь сохранится"
            />
            {errors.consent && (
              <p role="alert" className="-mt-2 text-sm text-danger-text">
                {errors.consent}
              </p>
            )}
            {register.isError &&
              !(register.error instanceof ApiError && Object.keys(register.error.fields).length) && (
                <FormAlert>{register.error.message}</FormAlert>
              )}
          </>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={register.isPending}
        rightIcon={isLast ? undefined : <IconArrowRight size={18} />}
      >
        {isLast ? 'Создать аккаунт' : 'Дальше'}
      </Button>

      <p className="text-center text-body text-muted">
        Уже есть аккаунт?{' '}
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
