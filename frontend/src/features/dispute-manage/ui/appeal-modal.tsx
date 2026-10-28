import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { disputeApi, disputeKeys, type Appealable, type ContestDisputes } from '@/entities/dispute'
import { formatDate } from '@/shared/lib'
import { ApiError } from '@/shared/api'
import { Button, Field, FormAlert, Input, Modal, Select, Textarea, showToast } from '@/shared/ui'
import { emptyEvidence, evidenceBody } from '../model/evidence'
import { EvidenceFields } from './evidence-fields'

const FIELDS = ['application_id', 'requested_place', 'reason', 'evidence_url', 'file_ids']

/**
 * Апелляция на место своей заявки или заявки подопечного: что не так, какое место верное, доказательства.
 * Со страницы соревнования — contestId и entries; из «Моих апелляций» — choices: сначала соревнование.
 */
export function AppealModal({
  open,
  contestId: fixedContest,
  entries: fixedEntries = [],
  choices,
  onClose,
}: {
  open: boolean
  contestId?: number
  entries?: ContestDisputes['entries']
  choices?: Appealable[]
  onClose: () => void
}) {
  const client = useQueryClient()
  const [chosen, setChosen] = useState(choices?.[0] ? String(choices[0].contest.id) : '')
  const choice = choices?.find((item) => String(item.contest.id) === chosen)
  const contestId = fixedContest ?? choice?.contest.id ?? 0
  const entries = choice?.entries ?? fixedEntries
  const [picked, setEntry] = useState('')
  const entry = entries.some((item) => String(item.application_id) === picked)
    ? picked
    : entries[0]
      ? String(entries[0].application_id)
      : ''
  const [place, setPlace] = useState('')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState(emptyEvidence)
  const save = useMutation({
    mutationFn: () =>
      disputeApi.fileAppeal(contestId, {
        application_id: Number(entry),
        requested_place: place ? Number(place) : null,
        reason: reason.trim(),
        ...evidenceBody(evidence),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: disputeKeys.all })
      showToast('Апелляция подана', {
        tone: 'success',
        description: 'Федерация рассмотрит её и пришлёт решение',
      })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const current = entries.find((item) => String(item.application_id) === entry)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (entry && reason.trim()) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Апелляция на результат"
      description="Решение принимает федерация. При удовлетворении места в протоколе исправляются"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!entry || !reason.trim()}>
            Подать
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {choices && (
          <Field
            label="Соревнование"
            required
            hint={choice ? `Апелляции принимаются до ${formatDate(choice.appeal_until)}` : undefined}
          >
            <Select
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
              options={choices.map((item) => ({
                value: String(item.contest.id),
                label: `${item.contest.title} · ${formatDate(item.contest.ends_on)}`,
              }))}
            />
          </Field>
        )}
        {(entries.length > 1 || choices) && (
          <Field label="Заявка" required error={error?.field('application_id')}>
            <Select
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              options={entries.map((item) => ({
                value: String(item.application_id),
                label: `${item.title}, ${item.place ? `${item.place} место` : 'без места'}`,
              }))}
            />
          </Field>
        )}
        <Field
          label="Какое место верное"
          hint={current?.place ? `Сейчас в протоколе — ${current.place}` : 'Сейчас места нет'}
          error={error?.field('requested_place')}
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            className="font-mono tabular-nums"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
          />
        </Field>
        <Field label="С чем вы не согласны" required error={error?.field('reason')}>
          <Textarea
            rows={4}
            maxLength={4000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <EvidenceFields
          value={evidence}
          onChange={setEvidence}
          urlError={error?.field('evidence_url')}
          filesError={error?.field('file_ids')}
        />
        {save.isError && !FIELDS.some((name) => error?.field(name)) && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
