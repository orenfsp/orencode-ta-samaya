import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { deadlineApi, type ReportDeadline } from '@/entities/deadline'
import { ApiError } from '@/shared/api'
import { Button, DateInput, Field, FormAlert, Input, Modal, Switch, Textarea, showToast } from '@/shared/ui'

/** Отчётный срок федерации: что, кому, до какого числа. Напоминания — за 7 дней, за день и в день срока */
export function ReportDeadlineModal({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: ReportDeadline | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const [title, setTitle] = useState(item?.title ?? '')
  const [recipient, setRecipient] = useState(item?.recipient ?? '')
  const [due, setDue] = useState(item?.due_on ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [done, setDone] = useState(Boolean(item?.done_at))
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        due_on: due,
        recipient: recipient.trim() || null,
        description: description.trim() || null,
        done,
      }
      return item ? deadlineApi.updateReport(item.id, body) : deadlineApi.createReport(body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['deadlines'] })
      showToast('Срок сохранён', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (title.trim() && due) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={item ? 'Отчётный срок' : 'Новый отчётный срок'}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!title.trim() || !due}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Отчёт" required error={error?.field('title')}>
          <Input value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Куда сдаём">
            <Input value={recipient} maxLength={300} onChange={(event) => setRecipient(event.target.value)} />
          </Field>
          <Field label="Срок" required error={error?.field('due_on')}>
            <DateInput value={due} onChange={setDue} />
          </Field>
        </div>
        <Field label="Что входит">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            minRows={2}
          />
        </Field>
        {item && (
          <Switch label="Отчёт сдан" checked={done} onChange={(event) => setDone(event.target.checked)} />
        )}
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
