import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { disputeApi, disputeKeys, type Sanction, type Violation } from '@/entities/dispute'
import { resultKeys } from '@/entities/result'
import { ApiError } from '@/shared/api'
import { orenburgDay } from '@/shared/lib'
import { Button, DateInput, Field, FormAlert, Modal, Select, Textarea, showToast } from '@/shared/ui'

const SANCTIONS: { value: Sanction | ''; label: string; hint: string }[] = [
  { value: '', label: 'Не подтвердилось', hint: 'Рапорт закрывается без последствий' },
  { value: 'warning', label: 'Предупреждение', hint: 'Запись в истории спортсмена, место не меняется' },
  {
    value: 'technical_defeat',
    label: 'Техническое поражение',
    hint: 'Последнее место, остальные поднимаются',
  },
  {
    value: 'disqualification',
    label: 'Дисквалификация на соревнование',
    hint: 'Место снимается, баллов нет',
  },
  { value: 'suspension', label: 'Отстранение на срок', hint: 'Нет рейтинга, сборной и новых заявок до даты' },
]

/** Решение федерации по рапорту о нарушении */
export function DecideViolationModal({
  open,
  violation,
  onClose,
}: {
  open: boolean
  violation: Violation
  onClose: () => void
}) {
  const client = useQueryClient()
  const [sanction, setSanction] = useState<Sanction | ''>('warning')
  const [decision, setDecision] = useState('')
  const [until, setUntil] = useState('')
  const save = useMutation({
    mutationFn: () =>
      disputeApi.decideViolation(violation.id, {
        sanction: sanction || null,
        decision: decision.trim(),
        suspended_until: sanction === 'suspension' ? until || null : null,
      }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: disputeKeys.all })
      void client.invalidateQueries({ queryKey: resultKeys.all })
      void client.invalidateQueries({ queryKey: ['ratings'] })
      showToast(result.sanction_title ?? result.status_title, {
        tone: 'success',
        description: violation.athlete.name,
      })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const ready = decision.trim() && (sanction !== 'suspension' || until)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (ready) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Решение по нарушению"
      description={`${violation.athlete.name} · ${violation.contest.title}`}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!ready}>
            Принять решение
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label="Санкция"
          hint={SANCTIONS.find((item) => item.value === sanction)?.hint}
          error={error?.field('sanction')}
        >
          <Select
            value={sanction}
            onChange={(event) => setSanction(event.target.value as Sanction | '')}
            options={SANCTIONS.map((item) => ({ value: item.value, label: item.label }))}
          />
        </Field>
        {sanction === 'suspension' && (
          <Field label="Отстранён до" required error={error?.field('suspended_until')}>
            <DateInput value={until} min={orenburgDay(new Date())} onChange={setUntil} />
          </Field>
        )}
        <Field
          label="Обоснование"
          required
          hint="Его увидят спортсмен и его тренер"
          error={error?.field('decision')}
        >
          <Textarea
            rows={3}
            maxLength={4000}
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          />
        </Field>
        {save.isError && !['sanction', 'suspended_until', 'decision'].some((name) => error?.field(name)) && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
