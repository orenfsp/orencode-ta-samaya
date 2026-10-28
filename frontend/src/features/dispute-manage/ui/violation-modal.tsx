import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { disputeApi, disputeKeys, type ContestDisputes } from '@/entities/dispute'
import { ApiError } from '@/shared/api'
import { Button, Field, FormAlert, Modal, SearchSelect, Textarea, showToast } from '@/shared/ui'
import { emptyEvidence, evidenceBody } from '../model/evidence'
import { EvidenceFields } from './evidence-fields'

const FIELDS = ['user_id', 'description', 'evidence_url', 'file_ids']

/** Рапорт судьи или федерации о нарушении участника */
export function ViolationModal({
  open,
  contestId,
  participants,
  onClose,
}: {
  open: boolean
  contestId: number
  participants: ContestDisputes['participants']
  onClose: () => void
}) {
  const client = useQueryClient()
  const [athlete, setAthlete] = useState('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState(emptyEvidence)
  const save = useMutation({
    mutationFn: () =>
      disputeApi.report(contestId, {
        user_id: athlete,
        description: description.trim(),
        ...evidenceBody(evidence),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: disputeKeys.all })
      showToast('Рапорт отправлен', { tone: 'success', description: 'Решение примет федерация' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (athlete && description.trim()) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Рапорт о нарушении"
      description="Участник увидит только решение федерации, без автора рапорта"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!athlete || !description.trim()}>
            Отправить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Участник" required error={error?.field('user_id')}>
          <SearchSelect
            value={athlete}
            onChange={setAthlete}
            options={[
              { value: '', label: 'Выберите участника' },
              ...participants.map((item) => ({
                value: item.athlete.id,
                label: item.team_name ? `${item.athlete.name}, «${item.team_name}»` : item.athlete.name,
              })),
            ]}
          />
        </Field>
        <Field label="Что произошло" required error={error?.field('description')}>
          <Textarea
            rows={4}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
