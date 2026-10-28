import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { qualificationApi, type Qualification } from '@/entities/qualification'
import { ApiError } from '@/shared/api'
import { formatDate, orenburgDay } from '@/shared/lib'
import { Button, DateInput, Facts, Field, FormAlert, Input, Modal } from '@/shared/ui'

/** Присвоение по приказу: номер и дата приказа обязательны, срок считается от сегодняшнего дня по справочнику */
export function ApproveModal({
  open,
  item,
  onClose,
  onDone,
}: {
  open: boolean
  item: Qualification | null
  onClose: () => void
  onDone: () => void
}) {
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(orenburgDay(new Date()))
  const preview = useQuery({
    queryKey: ['qualifications', 'preview', item?.id],
    queryFn: () => qualificationApi.preview(item!.id),
    enabled: open && Boolean(item),
  })
  const approve = useMutation({
    mutationFn: () => qualificationApi.approve(item!.id, { order_number: number.trim(), order_date: date }),
    onSuccess: onDone,
  })
  const error = approve.error instanceof ApiError ? approve.error : null
  const term = preview.isPending
    ? 'Считаем…'
    : preview.data?.valid_until
      ? `до ${formatDate(preview.data.valid_until)}`
      : 'Бессрочно'

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (number.trim() && date) approve.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={item?.kind === 'rank' ? 'Присвоить разряд' : 'Присвоить категорию'}
      description={item ? `${item.user.name}: «${item.item_name}»` : undefined}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={approve.isPending} disabled={!number.trim() || !date}>
            Присвоить
          </Button>
        </>
      }
    >
      {item && (
        <div className="flex flex-col gap-5">
          <Facts
            layout="row"
            items={[
              { label: 'Срок действия', value: term },
              item.basis_result && {
                label: 'Основание',
                value: `${item.basis_result.place} место · ${item.basis_result.contest_title}, ${item.basis_result.contest_level.toLowerCase()}`,
              },
              Boolean(item.basis) && { label: 'Пояснение', value: item.basis },
            ]}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Номер приказа" required error={error?.field('order_number')}>
              <Input value={number} maxLength={100} onChange={(event) => setNumber(event.target.value)} />
            </Field>
            <Field label="Дата приказа" required error={error?.field('order_date')}>
              <DateInput value={date} onChange={setDate} max={orenburgDay(new Date())} />
            </Field>
          </div>
          <p className="text-sm text-muted">
            Прежняя ступень станет недействующей. Присвоенному выдаётся QR для проверки
          </p>
          {approve.isError && !Object.keys(error?.fields ?? {}).length && (
            <FormAlert>{approve.error.message}</FormAlert>
          )}
        </div>
      )}
    </Modal>
  )
}
