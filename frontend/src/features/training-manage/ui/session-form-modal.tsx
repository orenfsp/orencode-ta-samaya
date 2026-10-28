import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  trainingApi,
  trainingKeys,
  type Enrollment,
  type SessionFormat,
  type TrainingSession,
} from '@/entities/training'
import { ApiError } from '@/shared/api'
import { orenburgDay } from '@/shared/lib'
import {
  Button,
  Checkbox,
  DateInput,
  Field,
  FormAlert,
  Input,
  Modal,
  Radio,
  Textarea,
  showToast,
} from '@/shared/ui'

/** Запись в журнале: дата, тема, формат, подтверждение онлайн-занятия и отметки зачисленных на дату */
export function SessionFormModal({
  open,
  groupId,
  enrollments,
  item,
  onClose,
}: {
  open: boolean
  groupId: number
  enrollments: Enrollment[]
  item: TrainingSession | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const [heldOn, setHeldOn] = useState(item?.held_on ?? orenburgDay(new Date()))
  const [topic, setTopic] = useState(item?.topic ?? '')
  const [format, setFormat] = useState<SessionFormat>(item?.format ?? 'offline')
  const [proof, setProof] = useState(item?.proof_url ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [present, setPresent] = useState<Set<string>>(
    () => new Set(item ? item.marks.filter((mark) => mark.present).map((mark) => mark.athlete.id) : []),
  )
  const roster = enrollments
    .filter((row) => row.valid_from <= heldOn && (!row.valid_to || row.valid_to > heldOn))
    .map((row) => row.athlete)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        held_on: heldOn,
        topic: topic.trim(),
        format,
        proof_url: proof.trim() || undefined,
        note: note.trim() || undefined,
        attendance: roster.map((athlete) => ({ athlete_id: athlete.id, present: present.has(athlete.id) })),
      }
      return item ? trainingApi.updateSession(item.id, body) : trainingApi.createSession(groupId, body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast(item ? 'Занятие сохранено' : 'Занятие записано', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const toggle = (id: string) =>
    setPresent((state) => {
      const next = new Set(state)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? 'Занятие' : 'Новое занятие'}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!topic.trim()}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Дата" required error={error?.field('held_on')}>
          <DateInput value={heldOn} onChange={setHeldOn} max={orenburgDay(new Date())} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-muted">Формат</legend>
          <div className="flex gap-6">
            <Radio
              label="Очно"
              name="format"
              checked={format === 'offline'}
              onChange={() => setFormat('offline')}
            />
            <Radio
              label="Онлайн"
              name="format"
              checked={format === 'online'}
              onChange={() => setFormat('online')}
            />
          </div>
        </fieldset>
        <Field label="Тема" required error={error?.field('topic')} className="sm:col-span-2">
          <Input value={topic} maxLength={300} onChange={(event) => setTopic(event.target.value)} />
        </Field>
        <Field
          label="Подтверждение"
          required={format === 'online'}
          hint="Ссылка на запись занятия или лог платформы"
          error={error?.field('proof_url')}
          className="sm:col-span-2"
        >
          <Input
            type="url"
            placeholder="https://"
            value={proof}
            onChange={(event) => setProof(event.target.value)}
          />
        </Field>
        <Field label="Заметка" className="sm:col-span-2">
          <Textarea
            value={note}
            maxLength={1000}
            minRows={2}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <fieldset className="flex flex-col gap-3 sm:col-span-2">
          <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm text-muted">
            <span>Посещение</span>
            <span className="font-mono tabular-nums">
              {roster.filter((athlete) => present.has(athlete.id)).length} из {roster.length}
            </span>
          </legend>
          {roster.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {roster.map((athlete) => (
                <Checkbox
                  key={athlete.id}
                  label={athlete.name}
                  checked={present.has(athlete.id)}
                  onChange={() => toggle(athlete.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">На эту дату в группе никто не числился</p>
          )}
          {error?.field('attendance') && <FormAlert>{error.field('attendance')}</FormAlert>}
        </fieldset>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
