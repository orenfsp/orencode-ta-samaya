import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useMe } from '@/entities/session'
import { fileApi } from '@/entities/file'
import {
  qualificationApi,
  qualificationKeys,
  useCoachAthletes,
  type Qualification,
  type QualificationKind,
} from '@/entities/qualification'
import { ApiError } from '@/shared/api'
import {
  Button,
  Field,
  FileDrop,
  FormAlert,
  Modal,
  SearchSelect,
  Select,
  Spinner,
  Textarea,
  showToast,
} from '@/shared/ui'
import { ageToday, DOCUMENT_ACCEPT, itemOptions } from '../model/options'

const TITLES: Record<QualificationKind, { item: string; basis: string }> = {
  judge_category: { item: 'Категория', basis: 'Приказ о присвоении, стаж, соревнования, которые судили' },
  rank: { item: 'Разряд или звание', basis: 'Соревнование и место, выполнены нормы ЕВСК' },
}

/**
 * Заявка на разряд или судейскую категорию: ступень из справочника, документ-основание, пояснение.
 * Тренер подаёт за спортсмена из своих заявок — тогда сверху выбор спортсмена.
 */
export function QualificationSubmitModal({
  open,
  kind,
  current,
  forAthlete,
  initial,
  onClose,
}: {
  open: boolean
  kind: QualificationKind
  /** Действующая ступень: ниже и на её уровне подать нельзя */
  current: Qualification | null
  forAthlete?: boolean
  /** Подсказка ЕВСК: ступень и место из протокола уже выбраны */
  initial?: { itemId?: number; resultId?: number; userId?: string }
  onClose: () => void
}) {
  const client = useQueryClient()
  const options = useDictionaryOptions(kind === 'rank' ? 'rank_types' : 'judge_categories')
  const { data: me } = useMe()
  const athletes = useCoachAthletes(Boolean(forAthlete) && open)
  const [athlete, setAthlete] = useState<string | null>(initial?.userId ?? null)
  const [item, setItem] = useState(initial?.itemId ? String(initial.itemId) : '')
  const [result, setResult] = useState(initial?.resultId ? String(initial.resultId) : '')
  const results = useQuery({
    queryKey: ['qualifications', 'results', athlete ?? 'me'],
    queryFn: ({ signal }) =>
      qualificationApi.results(forAthlete ? (athlete ?? undefined) : undefined, signal),
    enabled: open && kind === 'rank' && (!forAthlete || Boolean(athlete)),
  })
  const [file, setFile] = useState<{ id: string; name: string } | null>(null)
  const [basis, setBasis] = useState('')
  const [missing, setMissing] = useState<Record<string, string>>({})

  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (stored) => setFile({ id: stored.id, name: stored.original_name }),
  })
  const submit = useMutation({
    mutationFn: () =>
      qualificationApi.submit({
        kind,
        user_id: forAthlete ? (athlete ?? undefined) : undefined,
        item_id: Number(item),
        document_file_id: file!.id,
        basis: basis.trim() || undefined,
        contest_result_id: result ? Number(result) : undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qualificationKeys.all })
      showToast('Заявка отправлена в федерацию', { tone: 'success' })
      onClose()
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (forAthlete && !athlete) errors.user_id = 'Выберите спортсмена'
    if (!item) errors.item_id = 'Выберите ступень'
    if (!file) errors.document_file_id = 'Приложите документ'
    setMissing(errors)
    if (!Object.keys(errors).length) submit.mutate()
  }

  const error = submit.error instanceof ApiError ? submit.error : null
  const fieldError = (name: string) => missing[name] ?? error?.field(name)
  const general =
    submit.isError && !['user_id', 'item_id', 'document_file_id', 'basis'].some((name) => error?.field(name))
  const title = kind === 'rank' ? 'Заявка на разряд' : current ? 'Повысить категорию' : 'Заявка на категорию'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Решение принимает федерация. Срок действия считается со дня присвоения"
      size="md"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={submit.isPending} disabled={upload.isPending}>
            Отправить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {forAthlete && (
          <Field
            label="Спортсмен"
            required
            hint="Из заявок, которые вы подавали на соревнования"
            error={fieldError('user_id')}
          >
            <SearchSelect
              value={athlete}
              onChange={setAthlete}
              placeholder="Фамилия или имя"
              emptyText="Нет спортсменов из ваших заявок"
              options={(athletes.data ?? []).map((person) => ({ value: person.id, label: person.name }))}
            />
          </Field>
        )}
        <Field
          label={TITLES[kind].item}
          required
          error={
            fieldError('item_id') ?? (options.isError ? 'Список не загрузился, попробуйте позже' : undefined)
          }
        >
          <Select
            value={item}
            disabled={options.isPending || options.isError}
            onChange={(event) => setItem(event.target.value)}
            placeholder={options.isPending ? 'Загружаем…' : 'Выберите'}
            options={itemOptions(
              options.data ?? [],
              forAthlete ? null : current,
              kind === 'rank' && !forAthlete ? ageToday(me?.birth_date) : null,
            )}
          />
        </Field>
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
              label="Документ-основание"
              hint="PDF или DOCX, до 10 МБ"
              accept={DOCUMENT_ACCEPT}
              value={upload.isPending ? (upload.variables ?? null) : null}
              onChange={(picked) => picked && upload.mutate(picked)}
              error={fieldError('document_file_id') ?? (upload.isError ? upload.error.message : undefined)}
            />
          )}
          {upload.isPending && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Загружаем…
            </span>
          )}
        </div>
        {kind === 'rank' && (
          <Field
            label="Место из протокола"
            hint="По нему видно, за что получен разряд. Для соревнований вне платформы оставьте пустым"
            error={fieldError('contest_result_id')}
          >
            <Select
              value={result}
              onChange={(event) => setResult(event.target.value)}
              placeholder={
                results.isPending && results.fetchStatus !== 'idle' ? 'Загружаем…' : 'Без протокола платформы'
              }
              options={(results.data ?? []).map((row) => ({
                value: String(row.id),
                label: `${row.place} место · ${row.contest_title}`,
              }))}
            />
          </Field>
        )}
        <Field label="Основание" hint={TITLES[kind].basis} error={fieldError('basis')}>
          <Textarea
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
            maxLength={500}
            minRows={2}
          />
        </Field>
        {general && <FormAlert>{submit.error?.message}</FormAlert>}
      </div>
    </Modal>
  )
}
