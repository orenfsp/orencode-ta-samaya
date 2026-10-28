import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import {
  formatNormValue,
  parseNormValue,
  stageOptions,
  trainingApi,
  trainingKeys,
  unitOptions,
  type Norm,
  type NormDirection,
  type NormKind,
  type NormUnit,
  type TrainingStage,
} from '@/entities/training'
import { ApiError } from '@/shared/api'
import { Button, Checkbox, Field, FormAlert, Input, Modal, Select, Switch, showToast } from '@/shared/ui'

const threshold = (value: string | null, unit: NormUnit) =>
  value === null ? '' : formatNormValue(value, unit).replace('+', '')

/** Норматив ФССП: этап, вид подготовки, упражнение, пороги для юношей и девушек, дисциплины и источник */
export function NormFormModal({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: Norm | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const disciplines = useDictionaryOptions('disciplines')
  const [stage, setStage] = useState<TrainingStage>(item?.stage.value ?? 'initial')
  const [kind, setKind] = useState<NormKind>(item?.kind ?? 'ofp')
  const [name, setName] = useState(item?.name ?? '')
  const [unit, setUnit] = useState<NormUnit>(item?.unit ?? 'seconds')
  const [direction, setDirection] = useState<NormDirection>(item?.direction ?? 'lower')
  const [male, setMale] = useState(item ? threshold(item.threshold_male, item.unit) : '')
  const [female, setFemale] = useState(item ? threshold(item.threshold_female, item.unit) : '')
  const [chosen, setChosen] = useState<Set<number>>(new Set(item?.disciplines.map((value) => value.id) ?? []))
  const [source, setSource] = useState(item?.source ?? '')
  const [demo, setDemo] = useState(item?.is_demo ?? false)
  const [archived, setArchived] = useState(item?.is_archived ?? false)

  const save = useMutation({
    mutationFn: () => {
      const body = {
        stage,
        kind,
        name: name.trim(),
        unit,
        direction,
        threshold_male: male.trim() ? parseNormValue(male, unit) : null,
        threshold_female: female.trim() ? parseNormValue(female, unit) : null,
        discipline_ids: [...chosen],
        source: source.trim(),
        is_demo: demo,
        is_archived: archived,
      }
      return item ? trainingApi.updateNorm(item.id, body) : trainingApi.createNorm(body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast(item ? 'Норматив сохранён' : 'Норматив добавлен', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const toggle = (id: number) =>
    setChosen((state) => {
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
      title={item ? 'Норматив' : 'Новый норматив'}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim() || !source.trim()}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Этап" required>
          <Select
            value={stage}
            onChange={(event) => setStage(event.target.value as TrainingStage)}
            options={stageOptions.map((value) => ({ value: value.value, label: value.label }))}
          />
        </Field>
        <Field label="Вид подготовки" required>
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as NormKind)}
            options={[
              { value: 'ofp', label: 'Общая физическая (ОФП)' },
              { value: 'sfp', label: 'Специальная физическая (СФП)' },
            ]}
          />
        </Field>
        <Field label="Упражнение" required error={error?.field('name')} className="sm:col-span-2">
          <Input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Единица" required>
          <Select
            value={unit}
            onChange={(event) => setUnit(event.target.value as NormUnit)}
            options={unitOptions}
          />
        </Field>
        <Field label="Как сравнивать" required>
          <Select
            value={direction}
            onChange={(event) => setDirection(event.target.value as NormDirection)}
            options={[
              { value: 'higher', label: 'Не менее порога' },
              { value: 'lower', label: 'Не более порога' },
            ]}
          />
        </Field>
        <Field
          label="Порог, юноши"
          hint={unit === 'min_sec' ? 'Например, 6:20' : undefined}
          error={error?.field('threshold_male')}
        >
          <Input
            inputMode="decimal"
            className="font-mono tabular-nums"
            value={male}
            onChange={(event) => setMale(event.target.value)}
          />
        </Field>
        <Field label="Порог, девушки" hint="Пусто — норматив не установлен">
          <Input
            inputMode="decimal"
            className="font-mono tabular-nums"
            value={female}
            onChange={(event) => setFemale(event.target.value)}
          />
        </Field>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm text-muted">Дисциплины. Ничего не выбрано — для всех</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(disciplines.data ?? []).map((value) => (
              <Checkbox
                key={value.id}
                label={value.name}
                checked={chosen.has(value.id)}
                onChange={() => toggle(value.id)}
              />
            ))}
          </div>
          {error?.field('discipline_ids') && <FormAlert>{error.field('discipline_ids')}</FormAlert>}
        </fieldset>
        <Field label="Источник" required hint="Приказ и приложение" className="sm:col-span-2">
          <Input value={source} maxLength={300} onChange={(event) => setSource(event.target.value)} />
        </Field>
        <Switch label="Демо-значение" checked={demo} onChange={(event) => setDemo(event.target.checked)} />
        {item && (
          <Switch
            label="В архиве"
            checked={archived}
            onChange={(event) => setArchived(event.target.checked)}
          />
        )}
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
