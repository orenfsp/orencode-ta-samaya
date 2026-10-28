import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  formatNormValue,
  parseNormValue,
  stageOptions,
  trainingApi,
  trainingKeys,
  unitHint,
  useNorms,
  type TrainingGroup,
  type TrainingStage,
} from '@/entities/training'
import { ApiError } from '@/shared/api'
import { orenburgDay } from '@/shared/lib'
import { Button, DateInput, Field, FormAlert, Input, Modal, Select, showToast } from '@/shared/ui'

/** Приём нормативов у группы: один норматив, результат каждого. Выполнен или нет — решает платформа по порогу */
export function NormResultsModal({
  open,
  group,
  athletes,
  onClose,
}: {
  open: boolean
  group: TrainingGroup
  athletes: { id: string; name: string }[]
  onClose: () => void
}) {
  const client = useQueryClient()
  const next = stageOptions[stageOptions.findIndex((item) => item.value === group.stage.value) + 1]?.value
  const [stage, setStage] = useState<TrainingStage>(next ?? group.stage.value)
  const norms = useNorms(false, stage)
  const applicable = (norms.data ?? []).filter(
    (norm) => !norm.disciplines.length || norm.disciplines.some((item) => item.id === group.discipline.id),
  )
  const [normId, setNormId] = useState('')
  const norm = applicable.find((item) => String(item.id) === normId)
  const [on, setOn] = useState(orenburgDay(new Date()))
  const [values, setValues] = useState<Record<string, string>>({})
  const filled = athletes.filter((athlete) => values[athlete.id]?.trim())

  const save = useMutation({
    mutationFn: () =>
      trainingApi.record(
        filled.map((athlete) => ({
          athlete_id: athlete.id,
          norm_id: norm!.id,
          value: parseNormValue(values[athlete.id], norm!.unit),
          passed_on: on,
        })),
      ),
    onSuccess: (results) => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      const passed = results.filter((item) => item.passed).length
      showToast(`Внесено ${results.length}, выполнили ${passed}`, { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const invalid =
    Boolean(norm) && filled.some((athlete) => Number.isNaN(parseNormValue(values[athlete.id], norm!.unit)))

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (norm && filled.length && !invalid) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Приём нормативов"
      description={group.name}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!norm || !filled.length || invalid}>
            Сохранить результаты
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Нормативы этапа">
          <Select
            value={stage}
            onChange={(event) => {
              setStage(event.target.value as TrainingStage)
              setNormId('')
            }}
            options={stageOptions.map((item) => ({ value: item.value, label: item.label }))}
          />
        </Field>
        <Field label="Дата сдачи" required>
          <DateInput value={on} onChange={setOn} max={orenburgDay(new Date())} />
        </Field>
        <Field
          label="Норматив"
          required
          className="sm:col-span-2"
          hint={
            norm &&
            `${norm.direction_title} ${formatNormValue(norm.threshold_male, norm.unit)} юноши, ${formatNormValue(norm.threshold_female, norm.unit)} девушки · ${norm.source}`
          }
        >
          <Select
            value={normId}
            onChange={(event) => setNormId(event.target.value)}
            placeholder={
              norms.isPending
                ? 'Загружаем…'
                : applicable.length
                  ? 'Выберите'
                  : 'Для дисциплины нормативов нет'
            }
            disabled={!applicable.length}
            options={applicable.map((item) => ({
              value: String(item.id),
              label: `${item.kind === 'sfp' ? 'СФП' : 'ОФП'} · ${item.name}`,
            }))}
          />
        </Field>
        {norm && (
          <div className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft sm:col-span-2">
            {athletes.map((athlete) => (
              <label key={athlete.id} className="flex items-center justify-between gap-4 px-4 py-2">
                <span className="min-w-0 truncate text-ink">{athlete.name}</span>
                <span className="flex items-center gap-2">
                  <Input
                    aria-label={`Результат: ${athlete.name}`}
                    className="w-28 font-mono tabular-nums"
                    inputMode="decimal"
                    value={values[athlete.id] ?? ''}
                    onChange={(event) =>
                      setValues((state) => ({ ...state, [athlete.id]: event.target.value }))
                    }
                  />
                  <span className="w-14 text-sm text-muted">{unitHint[norm.unit]}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {invalid && <FormAlert className="sm:col-span-2">Результат — число, для минут — «6:20»</FormAlert>}
        {save.isError && (
          <FormAlert className="sm:col-span-2">
            {Object.values(error?.fields ?? {}).flat()[0] ?? save.error.message}
          </FormAlert>
        )}
      </div>
    </Modal>
  )
}
