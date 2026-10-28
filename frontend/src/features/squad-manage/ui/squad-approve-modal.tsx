import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { fileApi } from '@/entities/file'
import {
  squadApi,
  squadKeys,
  useSquadDraft,
  type Squad,
  type SquadCandidate,
  type SquadTarget,
} from '@/entities/squad'
import { ApiError } from '@/shared/api'
import { formatDate, formatNumber, orenburgDay } from '@/shared/lib'
import {
  Button,
  DateInput,
  ErrorState,
  Field,
  FileDrop,
  FormAlert,
  Input,
  Modal,
  Select,
  Skeleton,
  Spinner,
  showToast,
} from '@/shared/ui'

const LIMIT = 100
const FIELDS = ['main_size', 'reserve_size', 'order_number', 'order_date', 'order_file_id']

const size = (value: string, min: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= LIMIT ? number : null
}

function Lineup({
  title,
  items,
  of,
  action,
  onAction,
}: {
  title: string
  items: SquadCandidate[]
  of?: number
  action: string
  onAction: (item: SquadCandidate) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between gap-3 font-medium">
        {title}
        <span className="font-mono text-sm text-muted tabular-nums">
          {of === undefined ? items.length : `${items.length} из ${of}`}
        </span>
      </h3>
      {items.length > 0 && (
        <ol className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
          {items.map((item) => (
            <li key={item.athlete_id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 shrink-0 font-mono text-sm text-muted tabular-nums">{item.position}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ink">{item.name}</span>
                {item.municipality && <span className="text-sm text-muted">{item.municipality.name}</span>}
              </span>
              <span className="shrink-0 font-mono text-sm text-ink tabular-nums">
                {formatNumber(item.points)}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onAction(item)}>
                {action}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/**
 * Утверждение сборной по приказу. Состав — верх рейтинга; федерация может исключить спортсмена вручную,
 * его место займёт следующий. «Проект приказа» — PDF со списком сборной по текущему составу.
 * Если сборная уже есть, новый приказ заменяет её целиком, старый приказ удаляется.
 */
export function SquadApproveModal({
  open,
  target,
  title,
  current,
  onClose,
}: {
  open: boolean
  target: SquadTarget
  /** «Алгоритмическое программирование · 14–17 лет» */
  title: string
  current: Squad | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const [mainSize, setMainSize] = useState(String(current?.main_size ?? 5))
  const [reserveSize, setReserveSize] = useState(String(current?.reserve_size ?? 0))
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(orenburgDay(new Date()))
  const [file, setFile] = useState<{ id: string; name: string } | null>(null)
  const [missing, setMissing] = useState<Record<string, string>>({})
  const [minRank, setMinRank] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const ranks = useDictionaryOptions('rank_types')

  const main = size(mainSize, 1)
  const reserve = size(reserveSize, 0)
  const draft = useSquadDraft(
    target,
    main ?? 1,
    reserve ?? 0,
    open && main !== null && reserve !== null,
    minRank ? Number(minRank) : undefined,
    excluded,
  )
  const orderUrl = squadApi.orderDraftUrl(
    target,
    main ?? 1,
    reserve ?? 0,
    minRank ? Number(minRank) : undefined,
    excluded,
    number.trim(),
    date,
  )

  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (stored) => setFile({ id: stored.id, name: stored.original_name }),
  })
  const approve = useMutation({
    mutationFn: () =>
      squadApi.approve({
        ...target,
        main_size: main!,
        reserve_size: reserve!,
        order_number: number.trim(),
        order_date: date,
        order_file_id: file!.id,
        min_rank_id: minRank ? Number(minRank) : undefined,
        exclude_ids: excluded,
      }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: squadKeys.all })
      showToast(current ? 'Состав сборной обновлён' : 'Сборная утверждена', {
        tone: 'success',
        description: `Основной состав ${result.main}, резерв ${result.reserve}. Участникам отправлены уведомления`,
      })
      onClose()
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (main === null) errors.main_size = `От 1 до ${LIMIT}`
    if (reserve === null) errors.reserve_size = `От 0 до ${LIMIT}`
    if (!number.trim()) errors.order_number = 'Укажите номер приказа'
    if (!date) errors.order_date = 'Укажите дату приказа'
    if (!file) errors.order_file_id = 'Приложите приказ'
    setMissing(errors)
    if (!Object.keys(errors).length) approve.mutate()
  }

  const error = approve.error instanceof ApiError ? approve.error : null
  const fieldError = (name: string) => missing[name] ?? error?.field(name)
  const general = approve.isError && !FIELDS.some((name) => error?.field(name))
  const data = draft.data
  const short = data && data.available < data.main_size + data.reserve_size

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current ? 'Новый приказ о сборной' : 'Утвердить сборную'}
      description={title}
      size="lg"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            loading={approve.isPending}
            disabled={upload.isPending || !data || data.available === 0}
          >
            Утвердить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Основной состав, чел." required error={fieldError('main_size')}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMIT}
              value={mainSize}
              onChange={(event) => setMainSize(event.target.value)}
            />
          </Field>
          <Field label="Резерв, чел." error={fieldError('reserve_size')}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={LIMIT}
              value={reserveSize}
              onChange={(event) => setReserveSize(event.target.value)}
            />
          </Field>
          <Field label="Разряд не ниже" hint="Пусто — по рейтингу без фильтра" className="col-span-2">
            <Select
              value={minRank}
              onChange={(event) => setMinRank(event.target.value)}
              options={[
                { value: '', label: 'Любой, и без разряда' },
                ...(ranks.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
              ]}
            />
          </Field>
        </div>

        {draft.isError && !data ? (
          <ErrorState error={draft.error} onRetry={() => draft.refetch()} />
        ) : !data ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[1, 2, 3].map((id) => (
              <Skeleton key={id} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : data.available === 0 ? (
          <FormAlert>В рейтинге этой группы пока никого нет. Утвердить сборную нельзя</FormAlert>
        ) : (
          <div className="flex flex-col gap-5" aria-busy={draft.isFetching}>
            {short && (
              <FormAlert tone="info">
                В рейтинге {data.available} чел.: основной состав {data.main.length} из {data.main_size},
                резерв {data.reserve.length} из {data.reserve_size}
              </FormAlert>
            )}
            <Lineup
              title="Основной состав"
              items={data.main}
              of={data.main_size}
              action="Исключить"
              onAction={(item) => setExcluded((ids) => [...ids, item.athlete_id])}
            />
            {data.reserve_size > 0 && (
              <Lineup
                title="Резерв"
                items={data.reserve}
                of={data.reserve_size}
                action="Исключить"
                onAction={(item) => setExcluded((ids) => [...ids, item.athlete_id])}
              />
            )}
            {data.excluded.length > 0 && (
              <Lineup
                title="Исключены вручную"
                items={data.excluded}
                action="Вернуть"
                onAction={(item) => setExcluded((ids) => ids.filter((id) => id !== item.athlete_id))}
              />
            )}
            <div>
              <Button variant="secondary" href={orderUrl} external>
                Проект приказа и список, PDF
              </Button>
            </div>
            <p className="text-sm text-muted">
              Порядок как в рейтинге. При равных баллах выше тот, у кого свежее последняя победа, затем лучше
              среднее место
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Номер приказа" required error={fieldError('order_number')}>
            <Input value={number} maxLength={100} onChange={(event) => setNumber(event.target.value)} />
          </Field>
          <Field label="Дата приказа" required error={fieldError('order_date')}>
            <DateInput value={date} max={orenburgDay(new Date())} onChange={setDate} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line-soft px-4 py-3">
              <span className="truncate text-ink">{file.name}</span>
              <Button variant="text" size="sm" onClick={() => setFile(null)}>
                Заменить
              </Button>
            </div>
          ) : (
            <FileDrop
              label="Приказ"
              hint="PDF, до 10 МБ. Станет доступен всем вместе с составом"
              accept="application/pdf,.pdf"
              value={upload.isPending ? (upload.variables ?? null) : null}
              onChange={(picked) => picked && upload.mutate(picked)}
              error={fieldError('order_file_id') ?? (upload.isError ? upload.error.message : undefined)}
            />
          )}
          {upload.isPending && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Загружаем…
            </span>
          )}
        </div>

        {current && (
          <FormAlert tone="info">
            Состав по приказу № {current.order.number} от {formatDate(current.order.date)} заменится новым,
            старый приказ удалится. Кто не войдёт в новый состав, потеряет метку сборной
          </FormAlert>
        )}
        {general && <FormAlert>{approve.error?.message}</FormAlert>}
      </div>
    </Modal>
  )
}
