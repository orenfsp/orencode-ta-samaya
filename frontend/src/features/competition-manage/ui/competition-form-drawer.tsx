import { useState, type FormEvent } from 'react'
import {
  useRatingDefaults,
  type CompetitionScope,
  type ManagedCompetition,
  type RatingPoint,
} from '@/entities/competition'
import { useDictionaryOptions, type AnyDictionaryItem, type DictionaryKey } from '@/entities/dictionary'
import { ApiError } from '@/shared/api'
import {
  Button,
  Checkbox,
  DateInput,
  DateTimeInput,
  Drawer,
  Field,
  FormAlert,
  Input,
  SearchSelect,
  Select,
  Switch,
  Tabs,
  Textarea,
} from '@/shared/ui'
import { toDraft, toInput, validate, type Draft, type Errors } from '../model/form'
import type { CompetitionActions } from '../model/use-competition-actions'
import { PhotosField, RegulationsField } from './file-fields'
import { RatingPointsEditor } from './rating-points-editor'

const toOptions = (items: AnyDictionaryItem[] | undefined) =>
  (items ?? []).map((item) => ({ value: String(item.id), label: item.name }))

function useOptions(key: DictionaryKey) {
  const query = useDictionaryOptions(key)
  return { items: query.data ?? [], options: toOptions(query.data), pending: query.isPending }
}

export interface CompetitionFormDrawerProps {
  open: boolean
  scope: CompetitionScope
  /** Соревнование для правки; null — создание */
  item: ManagedCompetition | null
  actions: CompetitionActions
  /** Федерация выбирает организатора; по умолчанию — сам сотрудник */
  currentUserId: string
  organizers?: { value: string; label: string }[]
  onClose: () => void
}

/**
 * Форма соревнования в боковой панели. Черновик берётся из записи при монтировании,
 * поэтому страница задаёт key на каждое открытие — без синхронизации эффектами.
 */
export function CompetitionFormDrawer({
  open,
  scope,
  item,
  actions,
  currentUserId,
  organizers = [],
  onClose,
}: CompetitionFormDrawerProps) {
  const editing = item ?? undefined
  const admin = scope === 'admin'
  const [draft, setDraft] = useState<Draft>(() => toDraft(editing, currentUserId))
  const [errors, setErrors] = useState<Errors>({})
  const disciplines = useOptions('disciplines')
  const types = useOptions('contest_types')
  const levels = useOptions('contest_levels')
  const formats = useOptions('contest_formats')
  const municipalities = useOptions('municipalities')
  const ageGroups = useOptions('age_groups')
  const academicGroups = useOptions('academic_groups')
  const defaults = useRatingDefaults(admin && !editing)
  const mutation = editing ? actions.update : actions.create
  const serverError = mutation.error instanceof ApiError ? mutation.error : null
  const formatName = formats.items.find((format) => String(format.id) === draft.contest_format_id)?.name
  const online = formatName?.toLowerCase().includes('онлайн') ?? false

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const defaultPoints = (levelId: string): RatingPoint[] =>
    defaults.data?.find((row) => String(row.level.id) === levelId)?.rating_points ?? [
      { place: 1, points: 40 },
      { place: 2, points: 30 },
      { place: 3, points: 20 },
    ]

  const toggle = (field: 'age_group_ids' | 'academic_group_ids', id: number, checked: boolean) =>
    set(field, checked ? [...draft[field], id] : draft[field].filter((value) => value !== id))

  const fieldError = (field: keyof Draft) =>
    errors[field] ??
    serverError?.field(
      field === 'regulations' ? 'regulations_file_id' : field === 'photos' ? 'photo_file_ids' : field,
    )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate(draft, formatName)
    setErrors(found)
    if (Object.keys(found).length) return
    const body = toInput(draft, admin, !editing)
    if (editing) actions.update.mutate({ id: editing.id, body }, { onSuccess: onClose })
    else actions.create.mutate(body, { onSuccess: onClose })
  }

  const generalError =
    serverError && !Object.keys(serverError.fields).length
      ? serverError.message
      : mutation.isError && !serverError
        ? 'Не получилось сохранить. Проверьте соединение'
        : null
  const verified = editing?.verification_status === 'verified'

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={editing ? editing.title : 'Новое соревнование'}
      description={editing ? editing.status_title : 'Сохранится черновиком'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {generalError && <FormAlert>{generalError}</FormAlert>}
        {serverError?.fields.__root__ && <FormAlert>{serverError.fields.__root__.join('. ')}</FormAlert>}
        {!admin && verified && (
          <FormAlert tone="info">
            Соревнование верифицировано. Если изменить дисциплину, уровень, личное или командное участие,
            размер команды, группы или даты проведения, верификация вернётся на проверку федерации.
          </FormAlert>
        )}

        <Field label="Название" required error={fieldError('title')}>
          <Input
            value={draft.title}
            maxLength={300}
            onChange={(event) => set('title', event.target.value)}
            autoFocus
          />
        </Field>

        {admin && (
          <Field label="Организатор" error={fieldError('organizer_id')}>
            <SearchSelect
              value={draft.organizer_id}
              options={organizers}
              onChange={(value) => set('organizer_id', value)}
              placeholder="Выберите организатора"
            />
          </Field>
        )}

        <Field label="Дисциплина" required error={fieldError('discipline_id')}>
          <Select
            value={draft.discipline_id}
            placeholder={disciplines.pending ? 'Загружаем…' : 'Выберите дисциплину'}
            options={disciplines.options}
            onChange={(event) => set('discipline_id', event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Тип" required error={fieldError('contest_type_id')}>
            <Select
              value={draft.contest_type_id}
              placeholder="Тип"
              options={types.options}
              onChange={(event) => set('contest_type_id', event.target.value)}
            />
          </Field>
          <Field label="Уровень" required error={fieldError('contest_level_id')}>
            <Select
              value={draft.contest_level_id}
              placeholder="Уровень"
              options={levels.options}
              onChange={(event) => {
                set('contest_level_id', event.target.value)
                if (draft.verify_now) set('rating_points', defaultPoints(event.target.value))
              }}
            />
          </Field>
          <Field label="Формат" required error={fieldError('contest_format_id')}>
            <Select
              value={draft.contest_format_id}
              placeholder="Формат"
              options={formats.options}
              onChange={(event) => set('contest_format_id', event.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm text-ink">Участие</span>
          <Tabs
            aria-label="Личное или командное"
            value={draft.participation_type}
            onChange={(value) => set('participation_type', value)}
            items={[
              { value: 'individual', label: 'Личное' },
              { value: 'team', label: 'Командное' },
            ]}
          />
          {draft.participation_type === 'team' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Команда от, чел." required error={fieldError('team_size_min')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={draft.team_size_min}
                  onChange={(event) => set('team_size_min', event.target.value)}
                />
              </Field>
              <Field label="до, чел." required error={fieldError('team_size_max')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={draft.team_size_max}
                  onChange={(event) => set('team_size_max', event.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <Field
          label="Муниципалитет"
          required={!online}
          hint={online ? 'Для онлайн-формата можно не указывать' : undefined}
          error={fieldError('municipality_id')}
        >
          <SearchSelect
            value={draft.municipality_id || null}
            options={municipalities.options}
            onChange={(value) => set('municipality_id', value)}
            placeholder="Начните вводить название"
          />
        </Field>
        <Field label="Площадка" hint="Адрес или название места" error={fieldError('venue')}>
          <Input value={draft.venue} maxLength={300} onChange={(event) => set('venue', event.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Начало" required error={fieldError('starts_on')}>
            <DateInput value={draft.starts_on} onChange={(value) => set('starts_on', value)} />
          </Field>
          <Field label="Окончание" required error={fieldError('ends_on')}>
            <DateInput
              min={draft.starts_on || undefined}
              value={draft.ends_on}
              onChange={(value) => set('ends_on', value)}
            />
          </Field>
          <Field
            label="Приём заявок с"
            required
            hint="Время Оренбурга"
            error={fieldError('registration_opens_at')}
          >
            <DateTimeInput
              value={draft.registration_opens_at}
              onChange={(value) => set('registration_opens_at', value)}
            />
          </Field>
          <Field
            label="Приём заявок до"
            required
            hint="Не позже дня начала"
            error={fieldError('registration_closes_at')}
          >
            <DateTimeInput
              value={draft.registration_closes_at}
              onChange={(value) => set('registration_closes_at', value)}
            />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm text-ink">Возрастные группы, если есть ограничения</legend>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {ageGroups.items.map((group) => (
              <Checkbox
                key={group.id}
                label={group.name}
                checked={draft.age_group_ids.includes(group.id)}
                onChange={(event) => toggle('age_group_ids', group.id, event.target.checked)}
              />
            ))}
          </div>
          {fieldError('age_group_ids') && (
            <p className="text-sm text-danger-text">{fieldError('age_group_ids')}</p>
          )}
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm text-ink">Академические группы, если есть ограничения</legend>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {academicGroups.items.map((group) => (
              <Checkbox
                key={group.id}
                label={group.name}
                checked={draft.academic_group_ids.includes(group.id)}
                onChange={(event) => toggle('academic_group_ids', group.id, event.target.checked)}
              />
            ))}
          </div>
          {fieldError('academic_group_ids') && (
            <p className="text-sm text-danger-text">{fieldError('academic_group_ids')}</p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field
            label="Призовой фонд"
            hint="Необязательно, например «100 000 ₽ и мерч»"
            error={fieldError('prize_fund_text')}
          >
            <Input
              value={draft.prize_fund_text}
              maxLength={500}
              onChange={(event) => set('prize_fund_text', event.target.value)}
            />
          </Field>
          <Field label="Сумма, ₽" hint="Для фильтра" error={fieldError('prize_fund_amount')}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.prize_fund_amount}
              onChange={(event) => set('prize_fund_amount', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Описание" error={fieldError('description')}>
          <Textarea
            autoGrow
            minRows={4}
            maxLength={10000}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Программа, условия участия, для кого"
          />
        </Field>

        <RegulationsField
          value={draft.regulations}
          onChange={(file) => set('regulations', file)}
          error={fieldError('regulations')}
        />
        <PhotosField
          value={draft.photos}
          onChange={(files) => set('photos', files)}
          error={fieldError('photos')}
        />

        {admin && !editing && (
          <div className="flex flex-col gap-4 rounded-lg border border-line-soft p-4">
            <Switch
              label="Сразу верифицировать"
              description="Соревнование получит значок и будет влиять на рейтинг"
              checked={draft.verify_now}
              onChange={(event) => {
                set('verify_now', event.target.checked)
                if (event.target.checked && !draft.rating_points.length)
                  set('rating_points', defaultPoints(draft.contest_level_id))
              }}
            />
            {draft.verify_now && (
              <RatingPointsEditor
                value={draft.rating_points}
                onChange={(points) => set('rating_points', points)}
                error={fieldError('rating_points')}
              />
            )}
          </div>
        )}

        {editing && (
          <section className="flex flex-col gap-2 rounded-lg border border-line-soft p-4">
            <h3 className="font-mono text-sm text-muted">Верификация и баллы</h3>
            <p className="text-body text-ink">{editing.verification_title}</p>
            {editing.verification_reason && (
              <p className="text-sm text-muted">Причина отказа: {editing.verification_reason}</p>
            )}
            {editing.rating_points?.length ? (
              <p className="font-mono text-sm text-muted">
                {editing.rating_points.map((row) => `${row.place} место — ${row.points}`).join(' · ')}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {admin
                ? 'Баллы зафиксированы при верификации. Чтобы изменить, снимите верификацию и верифицируйте заново'
                : 'Задаёт федерация'}
            </p>
          </section>
        )}
      </div>
    </Drawer>
  )
}
