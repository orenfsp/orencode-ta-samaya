import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { disputeApi, disputeKeys, type Appeal } from '@/entities/dispute'
import { resultKeys, useResultsForm } from '@/entities/result'
import { ApiError } from '@/shared/api'
import {
  Button,
  ErrorState,
  Field,
  FormAlert,
  Input,
  Modal,
  Radio,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  showToast,
} from '@/shared/ui'

/** Решение федерации по апелляции: отклонить или удовлетворить с исправлением мест в протоколе */
export function DecideAppealModal({
  open,
  appeal,
  onClose,
}: {
  open: boolean
  appeal: Appeal
  onClose: () => void
}) {
  const client = useQueryClient()
  const [upheld, setUpheld] = useState(true)
  const [decision, setDecision] = useState('')
  const [edits, setEdits] = useState<Record<number, string>>({})
  const form = useResultsForm('admin', appeal.contest.id, open && upheld)
  const entries = form.data?.items ?? []
  const changed = entries.flatMap((item) => {
    const edit = edits[item.application_id]
    if (edit === undefined) return []
    const place = edit ? Number(edit) : null
    return place === item.place ? [] : [{ application_id: item.application_id, place }]
  })
  const save = useMutation({
    mutationFn: () =>
      disputeApi.decideAppeal(appeal.id, {
        upheld,
        decision: decision.trim(),
        places: upheld ? changed : [],
      }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: disputeKeys.all })
      void client.invalidateQueries({ queryKey: resultKeys.all })
      void client.invalidateQueries({ queryKey: ['ratings'] })
      showToast(`Апелляция ${result.status_title.toLowerCase()}`, {
        tone: 'success',
        description: upheld ? 'Места исправлены, документы перевыпущены' : 'Участники получили решение',
      })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const ready = decision.trim() && (!upheld || changed.length > 0)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (ready) save.mutate()
  }
  const name = (item: (typeof entries)[number]) =>
    item.team_name ?? item.athletes.map((athlete) => athlete.full_name).join(', ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Решение по апелляции"
      description={`${appeal.contest.title} · ${appeal.entry}`}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant={upheld ? 'primary' : 'danger'}
            loading={save.isPending}
            disabled={!ready}
          >
            {upheld ? 'Удовлетворить' : 'Отклонить'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-6" role="radiogroup" aria-label="Решение">
          <Radio name="upheld" label="Удовлетворить" checked={upheld} onChange={() => setUpheld(true)} />
          <Radio name="upheld" label="Отклонить" checked={!upheld} onChange={() => setUpheld(false)} />
        </div>
        <Field label="Обоснование" required hint="Его увидят участники" error={error?.field('decision')}>
          <Textarea
            rows={3}
            maxLength={4000}
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          />
        </Field>
        {upheld &&
          (form.isPending ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : form.isError ? (
            <ErrorState error={form.error} onRetry={() => void form.refetch()} />
          ) : (
            <Field
              label="Исправленные места"
              hint={`Участник просит ${appeal.requested_place ?? '—'} место. Пусто — дисквалификация. Места идут подряд с 1`}
              error={error?.field('items') ?? error?.field('places')}
            >
              <Table>
                <THead>
                  <TR>
                    <TH>Участник</TH>
                    <TH className="w-32 text-right">Место</TH>
                  </TR>
                </THead>
                <TBody>
                  {entries.map((item) => (
                    <TR key={item.application_id}>
                      <TD
                        className={item.application_id === appeal.application_id ? 'text-ink' : 'text-muted'}
                      >
                        {name(item)}
                      </TD>
                      <TD className="text-right">
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          aria-label={`Место: ${name(item)}`}
                          className="ml-auto w-24 text-right font-mono tabular-nums"
                          value={edits[item.application_id] ?? (item.place ? String(item.place) : '')}
                          onChange={(event) =>
                            setEdits((current) => ({ ...current, [item.application_id]: event.target.value }))
                          }
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Field>
          ))}
        {save.isError && !error?.field('decision') && !error?.field('items') && !error?.field('places') && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
