import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { sportProfileApi, sportProfileKeys, useLinkCandidates } from '@/entities/sport-profile'
import { ApiError } from '@/shared/api'
import { formatDate } from '@/shared/lib'
import {
  Button,
  Field,
  FormAlert,
  IconSearch,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  showToast,
} from '@/shared/ui'

/** Тренер находит спортсмена в реестре и просит привязку по дисциплине. Спортсмен подтверждает у себя */
export function LinkRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const client = useQueryClient()
  const disciplines = useDictionaryOptions('disciplines')
  const [q, setQ] = useState('')
  const [athlete, setAthlete] = useState<string | null>(null)
  const [discipline, setDiscipline] = useState('')
  const [comment, setComment] = useState('')
  const candidates = useLinkCandidates(q, open && q.trim().length >= 2)
  const send = useMutation({
    mutationFn: () =>
      sportProfileApi.requestLink({
        athlete_id: athlete!,
        discipline_id: Number(discipline),
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: sportProfileKeys.links })
      showToast('Запрос отправлен спортсмену', { tone: 'success' })
      onClose()
    },
  })
  const error = send.error instanceof ApiError ? send.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (athlete && discipline) send.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Привязать спортсмена"
      description="Спортсмен получит запрос и подтвердит его в своём профиле"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={send.isPending} disabled={!athlete || !discipline}>
            Отправить запрос
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
            <ul className="flex max-h-64 flex-col divide-y divide-line-soft overflow-y-auto rounded-lg border border-line-soft">
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
                      {[
                        `${formatDate(`${item.athlete.birth_date}T12:00:00Z`)} г. р.`,
                        item.municipality,
                        item.linked && 'уже ваш спортсмен',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        <Field label="Дисциплина" required error={error?.field('discipline_id')}>
          <Select
            value={discipline}
            onChange={(event) => setDiscipline(event.target.value)}
            placeholder="Выберите"
            options={(disciplines.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))}
          />
        </Field>
        <Field label="Комментарий">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            minRows={2}
          />
        </Field>
        {send.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert>{send.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
