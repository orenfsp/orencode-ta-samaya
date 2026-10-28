import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useOrganizationOptions } from '@/entities/organization'
import {
  stageOptions,
  trainingApi,
  trainingKeys,
  useOrganizationCard,
  type TrainingStage,
} from '@/entities/training'
import { ApiError } from '@/shared/api'
import { Button, Field, FormAlert, Input, Modal, SearchSelect, Select, showToast } from '@/shared/ui'

/** Новая учебно-тренировочная группа: по действующей программе организации. Федерация выбирает тренера */
export function GroupFormModal({
  open,
  onClose,
  isFederation,
}: {
  open: boolean
  onClose: () => void
  isFederation: boolean
}) {
  const client = useQueryClient()
  const organizations = useOrganizationOptions()
  const [organization, setOrganization] = useState<string | null>(null)
  const [program, setProgram] = useState('')
  const [coach, setCoach] = useState('')
  const [name, setName] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const card = useOrganizationCard(organization ? Number(organization) : null, false)
  const programs = card.data?.programs ?? []
  const chosen = programs.find((item) => String(item.id) === program)

  const save = useMutation({
    mutationFn: () =>
      trainingApi.createGroup({
        organization_id: Number(organization),
        discipline_id: chosen?.discipline.id,
        stage: chosen?.stage.value as TrainingStage,
        coach_id: isFederation ? coach || undefined : undefined,
        name: name.trim(),
        start_year: Number(year),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast('Группа создана', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Новая группа"
      description="Группа открывается по программе подготовки организации"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!organization || !chosen || !name.trim()}>
            Создать
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Организация" required error={error?.field('organization_id')} className="sm:col-span-2">
          <SearchSelect
            value={organization}
            onChange={(value) => {
              setOrganization(value)
              setProgram('')
              setCoach('')
            }}
            options={(organizations.data?.items ?? []).map((item) => ({
              value: String(item.id),
              label: item.short_name ?? item.name,
            }))}
          />
        </Field>
        <Field
          label="Программа"
          required
          error={error?.field('stage')}
          hint={
            organization && !card.isPending && !programs.length ? 'У организации нет программ' : undefined
          }
          className="sm:col-span-2"
        >
          <Select
            value={program}
            onChange={(event) => setProgram(event.target.value)}
            placeholder="Дисциплина и этап"
            disabled={!programs.length}
            options={programs.map((item) => ({
              value: String(item.id),
              label: `${item.discipline.name} · ${stageOptions.find((stage) => stage.value === item.stage.value)?.short}`,
            }))}
          />
        </Field>
        {isFederation && (
          <Field label="Тренер" required error={error?.field('coach_id')} className="sm:col-span-2">
            <Select
              value={coach}
              onChange={(event) => setCoach(event.target.value)}
              placeholder="Тренер-преподаватель организации"
              options={(card.data?.coaches ?? []).map((item) => ({
                value: item.coach.id,
                label: item.coach.name,
              }))}
            />
          </Field>
        )}
        <Field label="Название" required error={error?.field('name')}>
          <Input
            value={name}
            maxLength={120}
            placeholder="НП-1 · алгоритмика"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Год набора" required error={error?.field('start_year')}>
          <Input
            inputMode="numeric"
            className="font-mono tabular-nums"
            value={year}
            maxLength={4}
            onChange={(event) => setYear(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
