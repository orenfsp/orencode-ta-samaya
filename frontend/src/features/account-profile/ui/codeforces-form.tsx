import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { sessionApi, sessionKeys, type Me } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { Button, Field, Input, showToast } from '@/shared/ui'

/** Хэндл Codeforces — общий для аккаунта: показывается на странице человека, на рейтинг ФСП не влияет */
export function CodeforcesForm({ me }: { me: Me }) {
  const client = useQueryClient()
  const current = me.codeforces?.handle ?? ''
  const [handle, setHandle] = useState(current)
  const refresh = () => client.invalidateQueries({ queryKey: sessionKeys.me })
  const save = useMutation({
    mutationFn: sessionApi.saveCodeforces,
    onSuccess: (info) => {
      void refresh()
      showToast(info.status === 'ok' ? 'Хэндл сохранён, рейтинг обновлён' : 'Хэндл сохранён', {
        tone: 'success',
      })
    },
  })
  const remove = useMutation({
    mutationFn: sessionApi.removeCodeforces,
    onSuccess: () => {
      setHandle('')
      void refresh()
      showToast('Хэндл убран', { tone: 'success' })
    },
  })
  const error =
    save.error instanceof ApiError ? (save.error.field('handle') ?? save.error.message) : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (handle.trim()) save.mutate(handle.trim())
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 card p-5 sm:flex-row sm:items-end sm:p-6"
    >
      <Field
        label="Хэндл Codeforces"
        hint="Показывается на вашей странице. Рейтинг обновляется каждый час"
        error={error}
        className="min-w-0 flex-1"
      >
        <Input
          value={handle}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          placeholder="tourist"
          onChange={(event) => setHandle(event.target.value)}
        />
      </Field>
      <div className="flex gap-2 sm:mb-6">
        {current && (
          <Button variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()}>
            Убрать
          </Button>
        )}
        <Button type="submit" loading={save.isPending} disabled={!handle.trim() || handle.trim() === current}>
          Сохранить
        </Button>
      </div>
    </form>
  )
}
