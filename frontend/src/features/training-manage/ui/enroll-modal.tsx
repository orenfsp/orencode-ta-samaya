import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useLinkCandidates } from '@/entities/sport-profile'
import { trainingApi, trainingKeys, type TrainingGroup } from '@/entities/training'
import { ApiError } from '@/shared/api'
import { formatDate, orenburgDay } from '@/shared/lib'
import {
  Button,
  DateInput,
  Field,
  FormAlert,
  IconSearch,
  Input,
  Modal,
  Skeleton,
  showToast,
} from '@/shared/ui'

/** Зачисление спортсмена в группу приказом с датой. Этап и организация переходят в его спортивный профиль */
export function EnrollModal({
  open,
  group,
  onClose,
}: {
  open: boolean
  group: TrainingGroup
  onClose: () => void
}) {
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const [athlete, setAthlete] = useState<string | null>(null)
  const [on, setOn] = useState(orenburgDay(new Date()))
  const [order, setOrder] = useState('')
  const candidates = useLinkCandidates(q, open && q.trim().length >= 2)
  const save = useMutation({
    mutationFn: () =>
      trainingApi.enroll(group.id, { athlete_id: athlete!, on, order_number: order.trim() || undefined }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast('Спортсмен зачислен', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (athlete) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Зачислить в группу"
      description={`${group.name} · ${group.stage.title}`}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!athlete || !on}>
            Зачислить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Спортсмен" hint="Фамилия или имя, от двух букв" error={error?.field('athlete_id')}>
          <Input
            type="search"
            leftIcon={<IconSearch size={18} />}
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setAthlete(null)
            }}
          />
        </Field>
        {q.trim().length >= 2 &&
          (candidates.isPending ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : !candidates.data?.length ? (
            <p className="text-sm text-muted">Никого не нашли</p>
          ) : (
            <ul className="flex max-h-56 flex-col divide-y divide-line-soft overflow-y-auto rounded-lg border border-line-soft">
              {candidates.data.map((item) => (
                <li key={item.athlete.id}>
                  <button
                    type="button"
                    onClick={() => setAthlete(item.athlete.id)}
                    aria-pressed={athlete === item.athlete.id}
                    className="flex w-full flex-col items-start gap-0.5 field-focus px-4 py-2.5 text-left transition-colors hover:bg-hover-tint aria-pressed:bg-primary-soft"
                  >
                    <span className="text-ink">{item.athlete.name}</span>
                    <span className="text-sm text-muted">
                      {[`${formatDate(`${item.athlete.birth_date}T12:00:00Z`)} г. р.`, item.municipality]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Дата приказа" required error={error?.field('on')}>
            <DateInput value={on} onChange={setOn} max={orenburgDay(new Date())} />
          </Field>
          <Field label="Номер приказа">
            <Input value={order} maxLength={50} onChange={(event) => setOrder(event.target.value)} />
          </Field>
        </div>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
