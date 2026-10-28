import { useState, type FormEvent } from 'react'
import { Button } from './button'
import { Field } from './field'
import { FormAlert } from './form-alert'
import { Textarea } from './input'
import { Modal } from './modal'

/** Ошибка бэка с полями (ApiError) — без импорта shared/api: достаточно метода field */
type FieldError = Error & { field?: (name: string) => string | undefined }

/**
 * Действие с причиной: отказ, отмена, возврат на проверку. Одно окно на весь проект.
 * Держится в DOM и открывается пропом open — поэтому и закрывается с анимацией.
 * Текст сбрасывается при каждом новом открытии.
 */
export function ReasonModal({
  open,
  title,
  description,
  label = 'Причина',
  required = true,
  confirmLabel,
  tone = 'danger',
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  description?: string
  label?: string
  /** Необязательная причина — «Комментарий для журнала» */
  required?: boolean
  confirmLabel: string
  tone?: 'primary' | 'danger'
  pending: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  // Новое открытие — новый ключ формы: поле пустое, прошлая ошибка не висит
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((value) => value + 1)
  }
  const formId = `reason-form-${session}`

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Назад
          </Button>
          <Button type="submit" form={formId} variant={tone} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <ReasonForm
        key={session}
        id={formId}
        label={label}
        required={required}
        error={open ? (error as FieldError | null) : null}
        onSubmit={onSubmit}
      />
    </Modal>
  )
}

function ReasonForm({
  id,
  label,
  required,
  error,
  onSubmit,
}: {
  id: string
  label: string
  required: boolean
  error: FieldError | null
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [local, setLocal] = useState<string>()
  const fieldError = error?.field?.('reason')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = reason.trim()
    if ((required || value) && value.length < 3) return setLocal('Не короче 3 символов')
    onSubmit(value)
  }
  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && !fieldError && <FormAlert>{error.message}</FormAlert>}
      <Field label={label} required={required} error={local ?? fieldError}>
        <Textarea
          autoFocus
          autoGrow
          minRows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setLocal(undefined)
          }}
        />
      </Field>
    </form>
  )
}
