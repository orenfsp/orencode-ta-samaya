import { useState, type FormEvent } from 'react'
import { ApiError } from '@/shared/api'
import { Button, Field, FormAlert, Modal, Textarea } from '@/shared/ui'

/** Отказ с причиной: одна заявка или выбранные. Причину увидят участники */
export function RejectModal({
  title,
  description,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  pending: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [local, setLocal] = useState<string>()
  const server = error instanceof ApiError ? error : null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (reason.trim().length < 3) return setLocal('Не короче 3 символов')
    onSubmit(reason.trim())
  }
  return (
    <Modal
      open
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Назад
          </Button>
          <Button type="submit" form="application-reject-form" variant="danger" loading={pending}>
            Отклонить
          </Button>
        </>
      }
    >
      <form id="application-reject-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && !server?.field('reason') && <FormAlert>{error.message}</FormAlert>}
        <Field label="Причина отказа" required error={local ?? server?.field('reason')}>
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
    </Modal>
  )
}
