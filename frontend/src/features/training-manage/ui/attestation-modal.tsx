import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  formatNormValue,
  normStateTitles,
  trainingApi,
  trainingKeys,
  type AttestationResult,
  type Board,
  type BoardRow,
} from '@/entities/training'
import { ApiError } from '@/shared/api'
import { orenburgDay } from '@/shared/lib'
import {
  Button,
  DateInput,
  Field,
  FormAlert,
  Input,
  Modal,
  Radio,
  Select,
  StatusTag,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  showToast,
} from '@/shared/ui'

const tone = { passed: 'active', failed: 'cancelled', missing: 'draft', no_sex: 'draft' } as const

/** Итог аттестации спортсмена: нормативы следующего этапа, перевод в группу или «оставить на этапе» */
export function AttestationModal({
  open,
  board,
  row,
  isFederation,
  onClose,
}: {
  open: boolean
  board: Board
  row: BoardRow | null
  isFederation: boolean
  onClose: () => void
}) {
  const client = useQueryClient()
  const canTransfer = Boolean(board.target_stage) && (row?.ready || isFederation)
  const [result, setResult] = useState<AttestationResult>(canTransfer ? 'transferred' : 'retained')
  const [target, setTarget] = useState(board.targets[0] ? String(board.targets[0].id) : '')
  const [on, setOn] = useState(orenburgDay(new Date()))
  const [order, setOrder] = useState('')
  const [comment, setComment] = useState('')
  const override = result === 'transferred' && !row?.ready

  const save = useMutation({
    mutationFn: () =>
      trainingApi.decide({
        athlete_id: row!.athlete.id,
        group_id: board.group.id,
        result,
        target_group_id: result === 'transferred' ? Number(target) : undefined,
        on,
        order_number: order.trim() || undefined,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast(result === 'transferred' ? 'Перевод оформлен' : 'Итог аттестации записан', {
        tone: 'success',
      })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (row) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Промежуточная аттестация"
      description={row ? `${row.athlete.name} · ${board.group.name}` : undefined}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            loading={save.isPending}
            disabled={(result === 'transferred' && !target) || (override && !comment.trim())}
          >
            {result === 'transferred' ? 'Оформить перевод' : 'Сохранить итог'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {row && board.target_stage && (
          <Table>
            <THead>
              <TR>
                <TH>Норматив этапа «{board.target_stage.title}»</TH>
                <TH className="text-right">Порог</TH>
                <TH className="text-right">Лучший</TH>
                <TH>Итог</TH>
              </TR>
            </THead>
            <TBody>
              {row.norms.map((item) => (
                <TR key={item.norm.id}>
                  <TD>{item.norm.name}</TD>
                  <TD className="text-right font-mono tabular-nums">
                    {item.norm.direction === 'higher' ? '≥' : '≤'}{' '}
                    {formatNormValue(item.threshold, item.norm.unit)}
                  </TD>
                  <TD className="text-right font-mono tabular-nums">
                    {formatNormValue(item.best, item.norm.unit)}
                  </TD>
                  <TD>
                    <StatusTag tone={tone[item.state]}>{normStateTitles[item.state]}</StatusTag>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {row && board.target_stage && !row.norms.length && (
          <p className="text-sm text-muted">Для дисциплины группы нормативы следующего этапа не заданы</p>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-muted">Итог</legend>
          <Radio
            name="result"
            label={
              board.target_stage ? `Перевести на этап «${board.target_stage.title}»` : 'Следующего этапа нет'
            }
            description={
              row && !row.ready && board.target_stage
                ? isFederation
                  ? 'Нормативы выполнены не все: нужен комментарий с основанием'
                  : 'Нормативы выполнены не все: перевод без них оформляет федерация'
                : undefined
            }
            checked={result === 'transferred'}
            disabled={!canTransfer}
            onChange={() => setResult('transferred')}
          />
          <Radio
            name="result"
            label="Оставить на этапе"
            checked={result === 'retained'}
            onChange={() => setResult('retained')}
          />
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          {result === 'transferred' && (
            <Field
              label="Группа следующего этапа"
              required
              error={error?.field('target_group_id')}
              className="sm:col-span-2"
            >
              <Select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={board.targets.length ? 'Выберите' : 'Подходящих групп нет'}
                options={board.targets.map((item) => ({
                  value: String(item.id),
                  label: `${item.name} · ${item.organization.name}`,
                }))}
              />
            </Field>
          )}
          <Field label="Дата" required error={error?.field('on')}>
            <DateInput value={on} onChange={setOn} max={orenburgDay(new Date())} />
          </Field>
          <Field label="Номер приказа">
            <Input value={order} maxLength={50} onChange={(event) => setOrder(event.target.value)} />
          </Field>
          <Field
            label="Комментарий"
            required={override}
            error={error?.field('comment')}
            className="sm:col-span-2"
          >
            <Textarea
              value={comment}
              maxLength={1000}
              minRows={2}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
        </div>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
