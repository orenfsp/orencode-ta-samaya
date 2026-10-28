import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { trainingApi, trainingKeys, useTrainingGroups, type Enrollment } from '@/entities/training'
import { ApiError } from '@/shared/api'
import { orenburgDay } from '@/shared/lib'
import { Button, DateInput, Field, FormAlert, Input, Modal, Select, Textarea, showToast } from '@/shared/ui'

/** Перевод в другую группу той же дисциплины или отчисление. Зачисление закрывается датой приказа, история остаётся */
export function MoveModal({
  open,
  mode,
  enrollment,
  onClose,
}: {
  open: boolean
  mode: 'transfer' | 'expel'
  enrollment: Enrollment | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const [target, setTarget] = useState('')
  const [on, setOn] = useState(orenburgDay(new Date()))
  const [order, setOrder] = useState('')
  const [note, setNote] = useState('')
  const groups = useTrainingGroups(
    { discipline_id: enrollment?.group.discipline.id },
    open && mode === 'transfer' && Boolean(enrollment),
  )
  const options = (groups.data ?? []).filter((item) => item.id !== enrollment?.group.id)
  const save = useMutation({
    mutationFn: () => {
      const body = { on, order_number: order.trim() || undefined, note: note.trim() || undefined }
      return mode === 'transfer'
        ? trainingApi.transfer(enrollment!.id, { ...body, target_group_id: Number(target) })
        : trainingApi.expel(enrollment!.id, body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast(mode === 'transfer' ? 'Спортсмен переведён' : 'Спортсмен отчислен', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enrollment) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={mode === 'transfer' ? 'Перевести в другую группу' : 'Отчислить из группы'}
      description={enrollment ? `${enrollment.athlete.name} · ${enrollment.group.name}` : undefined}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant={mode === 'expel' ? 'danger' : 'primary'}
            loading={save.isPending}
            disabled={mode === 'transfer' && !target}
          >
            {mode === 'transfer' ? 'Перевести' : 'Отчислить'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {mode === 'transfer' && (
          <Field label="Группа" required error={error?.field('target_group_id')} className="sm:col-span-2">
            <Select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder={groups.isPending ? 'Загружаем…' : 'Выберите группу'}
              options={options.map((item) => ({
                value: String(item.id),
                label: `${item.name} · ${item.organization.name} · ${item.stage.title}`,
              }))}
            />
          </Field>
        )}
        <Field label="Дата приказа" required error={error?.field('on')}>
          <DateInput value={on} onChange={setOn} max={orenburgDay(new Date())} />
        </Field>
        <Field label="Номер приказа">
          <Input value={order} maxLength={50} onChange={(event) => setOrder(event.target.value)} />
        </Field>
        <Field label={mode === 'expel' ? 'Основание' : 'Комментарий'} className="sm:col-span-2">
          <Textarea
            value={note}
            maxLength={1000}
            minRows={2}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
