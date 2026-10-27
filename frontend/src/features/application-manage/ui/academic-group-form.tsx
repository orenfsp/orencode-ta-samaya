import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useMe, useSetAcademicGroup } from '@/entities/session'
import { Button, Field, Select, showToast } from '@/shared/ui'

/**
 * Академическая группа человека: класс или «Студенты». Без неё сервер не примет заявку,
 * поэтому форма стоит прямо там, где записываются, а не в отдельном профиле.
 */
export function AcademicGroupForm({ onSaved, compact = false }: { onSaved?: () => void; compact?: boolean }) {
  const { data: me } = useMe()
  const groups = useDictionaryOptions('academic_groups')
  const save = useSetAcademicGroup()
  const [value, setValue] = useState(() => (me?.academic_group ? String(me.academic_group.id) : ''))
  const options = [
    { value: '', label: 'Выберите группу' },
    ...(groups.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value) return
    save.mutate(Number(value), {
      onSuccess: () => {
        showToast('Академическая группа сохранена', { tone: 'success' })
        onSaved?.()
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3">
      <Field
        label="Академическая группа"
        hint={compact ? undefined : 'Класс или «Студенты». По ней проверяется допуск и считается рейтинг'}
        error={save.error?.message}
        className="min-w-56 flex-1"
      >
        <Select
          value={value}
          options={options}
          disabled={groups.isPending}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        loading={save.isPending}
        disabled={!value || value === String(me?.academic_group?.id ?? '')}
      >
        Сохранить
      </Button>
    </form>
  )
}
