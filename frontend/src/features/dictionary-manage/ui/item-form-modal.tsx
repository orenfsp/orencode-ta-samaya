import { useState, type FormEvent } from 'react'
import {
  dictionaryKind,
  formatAgeRange,
  formatMonths,
  rankKinds,
  type AnyDictionaryItem,
  type DictionaryItemInput,
  type DictionaryKey,
  type RankKind,
} from '@/entities/dictionary'
import { ApiError } from '@/shared/api'
import { Button, Modal, Field, FormAlert, Input, Select, Switch, Textarea } from '@/shared/ui'
import type { DictionaryActions } from '../model/use-dictionary-actions'

interface Draft {
  name: string
  description: string
  min_age: string
  max_age: string
  rank_kind: RankKind
  is_lifetime: boolean
  validity_months: string
  valid_until_age: string
}

type Errors = Partial<Record<keyof Draft, string>>

const toDraft = (item?: AnyDictionaryItem): Draft => ({
  name: item?.name ?? '',
  description: item?.description ?? '',
  min_age: item?.min_age?.toString() ?? '',
  max_age: item?.max_age?.toString() ?? '',
  rank_kind: item?.rank_kind ?? 'Спортивный разряд',
  is_lifetime: item?.is_lifetime ?? false,
  validity_months: item?.validity_months?.toString() ?? '',
  valid_until_age: item?.valid_until_age?.toString() ?? '',
})

const num = (value: string) => (value.trim() === '' ? null : Number(value))

/** Те же правила, что в домене бэка: заведомо неверное не отправляем */
function validate(key: DictionaryKey, draft: Draft): Errors {
  const errors: Errors = {}
  const kind = dictionaryKind(key)
  if (!draft.name.trim()) errors.name = 'Укажите название'
  if (kind === 'age') {
    const min = num(draft.min_age)
    const max = num(draft.max_age)
    if (min == null && max == null) errors.min_age = 'Укажите хотя бы одну границу'
    if (min != null && max != null && max < min) errors.max_age = 'Не может быть меньше «от»'
  }
  if (kind === 'rank') {
    if (!draft.is_lifetime && !draft.validity_months) errors.validity_months = 'Укажите срок действия'
    if (draft.rank_kind !== 'Спортивное звание' && !draft.min_age)
      errors.min_age = 'Укажите минимальный возраст'
  }
  return errors
}

function toInput(key: DictionaryKey, draft: Draft): DictionaryItemInput {
  const base = { name: draft.name.trim(), description: draft.description.trim() || null }
  switch (dictionaryKind(key)) {
    case 'age':
      return { ...base, min_age: num(draft.min_age), max_age: num(draft.max_age) }
    case 'rank':
      return {
        ...base,
        rank_kind: draft.rank_kind,
        is_lifetime: draft.is_lifetime,
        min_age: num(draft.min_age),
        validity_months: draft.is_lifetime ? null : num(draft.validity_months),
        valid_until_age: draft.rank_kind === 'Юношеский разряд' ? num(draft.valid_until_age) : null,
      }
    case 'judge':
      return { ...base, validity_months: num(draft.validity_months) }
    default:
      return base
  }
}

export interface ItemFormModalProps {
  open: boolean
  dictionaryKey: DictionaryKey
  dictionaryTitle: string
  /** Запись для правки; null — создание новой */
  item: AnyDictionaryItem | null
  actions: DictionaryActions
  onClose: () => void
}

/**
 * Карточка записи справочника в боковой панели. Черновик берётся из записи при монтировании,
 * поэтому страница задаёт key на каждое открытие — без синхронизации эффектами.
 */
export function ItemFormModal({
  open,
  dictionaryKey,
  dictionaryTitle,
  item,
  actions,
  onClose,
}: ItemFormModalProps) {
  const editing = item ?? undefined
  const [draft, setDraft] = useState<Draft>(() => toDraft(editing))
  const [errors, setErrors] = useState<Errors>({})
  const kind = dictionaryKind(dictionaryKey)
  const mutation = editing ? actions.update : actions.create
  const serverError = mutation.error instanceof ApiError ? mutation.error : null

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const fieldError = (field: keyof Draft) =>
    errors[field] ??
    serverError?.field(field) ??
    (field === 'name' && serverError?.code === 'name_taken' ? 'Такое значение уже есть' : undefined)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate(dictionaryKey, draft)
    setErrors(found)
    if (Object.keys(found).length) return
    const body = toInput(dictionaryKey, draft)
    const options = { onSuccess: onClose }
    if (editing) actions.update.mutate({ id: editing.id, body }, options)
    else actions.create.mutate(body, options)
  }

  const renamed = editing && draft.name.trim() !== editing.name
  const generalError =
    serverError && !Object.keys(serverError.fields).length && serverError.code !== 'name_taken'
      ? serverError.message
      : mutation.isError && !serverError
        ? 'Не получилось сохранить. Проверьте соединение'
        : null

  return (
    <Modal
      size="md"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={editing ? editing.name : 'Новое значение'}
      description={dictionaryTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {generalError && <FormAlert>{generalError}</FormAlert>}

        <Field label="Название" required error={fieldError('name')}>
          <Input
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            maxLength={200}
            autoFocus
          />
        </Field>
        {renamed && (
          <FormAlert tone="info">
            Новое название появится везде, где из справочника выбирают. Если это другой вариант, а старым
            больше не пользуются, отправьте старое значение в архив и создайте новое.
          </FormAlert>
        )}

        {kind === 'age' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="От, лет" hint="Можно не указывать" error={fieldError('min_age')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={draft.min_age}
                  onChange={(event) => set('min_age', event.target.value)}
                />
              </Field>
              <Field label="До, лет" hint="Включительно, можно не указывать" error={fieldError('max_age')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={draft.max_age}
                  onChange={(event) => set('max_age', event.target.value)}
                />
              </Field>
            </div>
            <p className="-mt-1 font-mono text-sm text-muted">
              Группа: {formatAgeRange(num(draft.min_age), num(draft.max_age))} · возраст на дату начала
              соревнования
            </p>
          </>
        )}

        {kind === 'rank' && (
          <>
            <Field label="Вид" error={fieldError('rank_kind')}>
              <Select
                value={draft.rank_kind}
                onChange={(event) => set('rank_kind', event.target.value as RankKind)}
                options={rankKinds.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field
              label="Минимальный возраст, лет"
              required={draft.rank_kind !== 'Спортивное звание'}
              hint={draft.rank_kind === 'Спортивное звание' ? 'Для званий необязательно' : undefined}
              error={fieldError('min_age')}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={draft.min_age}
                onChange={(event) => set('min_age', event.target.value)}
              />
            </Field>
            <Switch
              label="Пожизненно"
              description="Не требует подтверждения, срока действия нет"
              checked={draft.is_lifetime}
              onChange={(event) => set('is_lifetime', event.target.checked)}
            />
            {!draft.is_lifetime && (
              <Field
                label="Срок действия, месяцев"
                required
                hint={
                  draft.validity_months ? formatMonths(Number(draft.validity_months)) : 'Например, 24 месяца'
                }
                error={fieldError('validity_months')}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draft.validity_months}
                  onChange={(event) => set('validity_months', event.target.value)}
                />
              </Field>
            )}
            {draft.rank_kind === 'Юношеский разряд' && (
              <Field
                label="Действует до возраста, лет"
                hint="Срок не может выйти за этот возраст"
                error={fieldError('valid_until_age')}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={draft.valid_until_age}
                  onChange={(event) => set('valid_until_age', event.target.value)}
                />
              </Field>
            )}
          </>
        )}

        {kind === 'judge' && (
          <>
            <Switch
              label="Бессрочно"
              checked={draft.validity_months === ''}
              onChange={(event) => set('validity_months', event.target.checked ? '' : '24')}
            />
            {draft.validity_months !== '' && (
              <Field
                label="Срок действия, месяцев"
                hint={draft.validity_months ? formatMonths(Number(draft.validity_months)) : undefined}
                error={fieldError('validity_months')}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draft.validity_months}
                  onChange={(event) => set('validity_months', event.target.value)}
                />
              </Field>
            )}
          </>
        )}

        <Field
          label="Описание"
          hint="Пояснение для федерации, в выборе не показывается"
          error={fieldError('description')}
        >
          <Textarea
            autoGrow
            minRows={2}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
