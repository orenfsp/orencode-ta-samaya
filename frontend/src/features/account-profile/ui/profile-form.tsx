import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useUpdateProfile, type Me } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { Button, DateInput, Field, FormAlert, Input, Select, showToast } from '@/shared/ui'

/**
 * ФИО, дата рождения и академическая группа — данные аккаунта, общие для всех ролей.
 * Выданные документы — снимки на дату выдачи: правка их не меняет.
 */
export function ProfileForm({ me }: { me: Me }) {
  const groups = useDictionaryOptions('academic_groups')
  const save = useUpdateProfile()
  const initial = {
    last_name: me.last_name,
    first_name: me.first_name,
    middle_name: me.middle_name ?? '',
    birth_date: me.birth_date,
    academic_group_id: me.academic_group ? String(me.academic_group.id) : '',
  }
  const [draft, setDraft] = useState(initial)
  const error = save.error instanceof ApiError ? save.error : null
  const changed = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (key) => draft[key] !== initial[key],
  )
  const set = (key: keyof typeof initial, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      {
        last_name: draft.last_name.trim(),
        first_name: draft.first_name.trim(),
        middle_name: draft.middle_name.trim() || null,
        birth_date: draft.birth_date,
        academic_group_id: draft.academic_group_id ? Number(draft.academic_group_id) : null,
      },
      { onSuccess: () => showToast('Профиль сохранён', { tone: 'success' }) },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 card p-5 sm:p-6">
      {error && !Object.keys(error.fields).length && <FormAlert>{error.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Фамилия" required error={error?.field('last_name')}>
          <Input
            value={draft.last_name}
            maxLength={100}
            onChange={(event) => set('last_name', event.target.value)}
          />
        </Field>
        <Field label="Имя" required error={error?.field('first_name')}>
          <Input
            value={draft.first_name}
            maxLength={100}
            onChange={(event) => set('first_name', event.target.value)}
          />
        </Field>
        <Field label="Отчество" error={error?.field('middle_name')}>
          <Input
            value={draft.middle_name}
            maxLength={100}
            onChange={(event) => set('middle_name', event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Дата рождения" required error={error?.field('birth_date')}>
          <DateInput value={draft.birth_date} onChange={(value) => set('birth_date', value)} />
        </Field>
        <Field
          label="Академическая группа"
          hint="Нужна для заявок на соревнования"
          error={error?.field('academic_group_id')}
          className="sm:col-span-2"
        >
          <Select
            value={draft.academic_group_id}
            onChange={(event) => set('academic_group_id', event.target.value)}
            options={[
              { value: '', label: 'Не указана' },
              ...(groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name })),
            ]}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-4">
        {changed && (
          <Button variant="ghost" onClick={() => setDraft(initial)} disabled={save.isPending}>
            Отменить
          </Button>
        )}
        <Button type="submit" loading={save.isPending} disabled={!changed}>
          Сохранить
        </Button>
      </div>
    </form>
  )
}
