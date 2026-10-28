import { useEffect, useState, type FormEvent } from 'react'
import {
  documentApi,
  type DocumentForm,
  type DocumentGroup,
  type DocumentKind,
  type DocumentScope,
} from '@/entities/document'
import { useJudgePanel } from '@/entities/qualification'
import { ApiError } from '@/shared/api'
import { plural } from '@/shared/lib'
import {
  Button,
  Checkbox,
  DateInput,
  Field,
  FormAlert,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '@/shared/ui'
import { formFor, kindLabels, kindOrder, kindRecipients } from '../model/presets'
import type { DocumentActions } from '../model/use-document-actions'

const problem = (error: unknown) =>
  error instanceof ApiError
    ? (error.field('recipients') ?? error.field('title') ?? error.message)
    : 'Не удалось собрать документ'

/**
 * Выпуск документов соревнования: сертификаты, дипломы, грамоты, благодарности тренерам, справки.
 * Человек задаёт только текст. ФИО, команду, место, подопечных, QR и оформление ФСП ставит сервер.
 * Повторный выпуск вида заменяет прежние документы.
 */
export function DocumentsModal({
  scope,
  contest,
  groups,
  initialKind,
  actions,
  open,
  onClose,
}: {
  scope: DocumentScope
  contest: { id: number; title: string }
  groups: DocumentGroup[]
  initialKind: DocumentKind
  actions: DocumentActions
  open: boolean
  onClose: () => void
}) {
  const groupOf = (kind: DocumentKind) => groups.find((group) => group.kind === kind)
  const [kind, setKind] = useState<DocumentKind>(initialKind)
  const [form, setForm] = useState<DocumentForm>(() => formFor(initialKind, groupOf(initialKind)))
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const panel = useJudgePanel(contest.id, open && kind === 'judge_thanks')
  const judges = panel.data?.items ?? []
  const picked = form.judge_ids ?? judges.map((item) => item.judge.id)
  const toggleJudge = (id: string) =>
    set('judge_ids', picked.includes(id) ? picked.filter((value) => value !== id) : [...picked, id])

  const existing = groupOf(kind)?.items.length ?? 0
  const reference = kind === 'reference' || kind === 'judge_panel'
  const winners = kind === 'diploma' || (kind === 'gramota' && form.recipients === 'winners')

  const set = <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) => {
    setError(null)
    setForm((current) => ({ ...current, [key]: value }))
  }
  const choose = (next: DocumentKind) => {
    setError(null)
    setKind(next)
    setForm(formFor(next, groupOf(next)))
    setPreview(null)
  }

  const showPreview = async () => {
    if (!form.title.trim()) return setError('Введите заголовок')
    setPreviewing(true)
    try {
      setPreview(URL.createObjectURL(await documentApi.preview(scope, contest.id, kind, form)))
    } catch (reason) {
      setError(problem(reason))
    } finally {
      setPreviewing(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return setError('Введите заголовок')
    actions.issue.mutate(
      { kind, form: { ...form, recipients: kind === 'diploma' ? 'winners' : form.recipients } },
      { onSuccess: onClose, onError: (reason) => setError(problem(reason)) },
    )
  }

  return (
    <Modal
      size="xl"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Документы участникам"
      description={contest.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={actions.issue.isPending}>
            {existing ? 'Выпустить заново' : 'Выпустить'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Вид документа" hint={kindRecipients[kind]}>
            <Select
              value={kind}
              onChange={(event) => choose(event.target.value as DocumentKind)}
              options={kindOrder.map((value) => ({ value, label: kindLabels[value] }))}
            />
          </Field>
          {existing > 0 && (
            <FormAlert tone="info">
              Уже выдано {existing} {plural(existing, ['документ', 'документа', 'документов'])}. Новый выпуск
              их заменит, старые QR-коды перестанут открываться
            </FormAlert>
          )}
          <Field label={reference ? 'Подзаголовок справки' : 'Заголовок'} required>
            <Input value={form.title} maxLength={40} onChange={(event) => set('title', event.target.value)} />
          </Field>
          {kind === 'judge_thanks' && (
            <Field
              label="Кому из коллегии"
              hint={panel.isSuccess && !judges.length ? 'Коллегия не назначена' : undefined}
            >
              <div className="flex flex-col gap-1">
                {panel.isPending ? (
                  <Spinner className="size-5" />
                ) : (
                  judges.map((item) => (
                    <Checkbox
                      key={item.id}
                      label={item.judge.name}
                      description={item.position.name}
                      checked={picked.includes(item.judge.id)}
                      onChange={() => toggleJudge(item.judge.id)}
                    />
                  ))
                )}
              </div>
            </Field>
          )}
          {(kind === 'gramota' || winners) && (
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
              {kind === 'gramota' ? (
                <Field label="Кому">
                  <Select
                    value={form.recipients}
                    onChange={(event) => set('recipients', event.target.value as DocumentForm['recipients'])}
                    options={[
                      { value: 'participants', label: 'Всем участникам' },
                      { value: 'winners', label: 'Призёрам' },
                    ]}
                  />
                </Field>
              ) : (
                <span className="pb-3 text-sm text-muted">Призёрам с местами</span>
              )}
              <Field label="Места 1–">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  className="font-mono tabular-nums"
                  disabled={!winners}
                  value={form.places_to}
                  onChange={(event) => set('places_to', Math.max(1, Number(event.target.value) || 1))}
                />
              </Field>
            </div>
          )}
          {!reference && (
            <Field label="Перед ФИО" hint="Например, «награждается»">
              <Input
                value={form.lead}
                maxLength={200}
                onChange={(event) => set('lead', event.target.value)}
              />
            </Field>
          )}
          <Field label={reference ? 'Дополнительный текст' : 'Текст'}>
            <Textarea
              rows={3}
              counter
              maxLength={400}
              value={form.text}
              onChange={(event) => set('text', event.target.value)}
            />
          </Field>
          <Field label="Должность подписанта">
            <Input
              value={form.signer_position}
              maxLength={200}
              placeholder="Председатель регионального отделения ФСП"
              onChange={(event) => set('signer_position', event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Подписант">
              <Input
                value={form.signer_name}
                maxLength={100}
                placeholder="И. О. Фамилия"
                onChange={(event) => set('signer_name', event.target.value)}
              />
            </Field>
            <Field label="Дата выдачи">
              <DateInput value={form.issued_on} onChange={(value) => set('issued_on', value)} />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Первая страница</span>
            <Button variant="secondary" size="sm" loading={previewing} onClick={showPreview}>
              {preview ? 'Обновить' : 'Показать'}
            </Button>
          </div>
          <div
            className={
              reference
                ? 'relative mx-auto aspect-[210/297] w-full max-w-md overflow-hidden rounded-lg border border-line-soft bg-surface-2'
                : 'relative aspect-[297/210] overflow-hidden rounded-lg border border-line-soft bg-surface-2'
            }
          >
            {preview ? (
              <iframe
                title="Предпросмотр документа"
                src={`${preview}#toolbar=0&navpanes=0&view=Fit`}
                className="absolute inset-0 size-full"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">
                {previewing ? <Spinner /> : 'Здесь появится первая страница'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
