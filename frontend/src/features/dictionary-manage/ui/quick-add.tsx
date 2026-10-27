import { useState, type FormEvent } from 'react'
import { ApiError } from '@/shared/api'
import { cn } from '@/shared/lib'
import { IconPlus, Spinner } from '@/shared/ui'
import type { DictionaryActions } from '../model/use-dictionary-actions'

/** Быстрое добавление для справочников «только название»: напечатал, Enter — значение в списке, поле снова пустое */
export function QuickAdd({ actions, placeholder }: { actions: DictionaryActions; placeholder: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pending = actions.create.isPending

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (!value || pending) return
    actions.create.mutate(
      { name: value, description: null },
      {
        onSuccess: () => {
          setName('')
          setError(null)
        },
        onError: (failure) =>
          setError(
            failure instanceof ApiError && failure.code === 'name_taken'
              ? 'Такое значение уже есть'
              : (failure instanceof ApiError && failure.field('name')) || failure.message,
          ),
      },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label
        className={cn(
          'group flex items-center gap-3 rounded-md border border-dashed px-4 transition-[border-color,background-color] duration-150',
          error
            ? 'border-danger'
            : 'border-line focus-within:border-primary focus-within:bg-surface-2 hover:border-ink/40',
        )}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-surface-3 text-ink transition-colors group-focus-within:bg-primary group-focus-within:text-white">
          {pending ? <Spinner className="size-3.5" /> : <IconPlus size={16} />}
        </span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          maxLength={200}
          placeholder={placeholder}
          aria-label="Новое значение"
          aria-invalid={Boolean(error) || undefined}
          className="min-h-12 flex-1 bg-transparent text-body text-ink placeholder:text-muted focus:outline-none"
        />
        <kbd className="hidden rounded-xs border border-line-soft px-1.5 py-0.5 font-mono text-xs text-muted transition-opacity group-focus-within:opacity-100 sm:block sm:opacity-0">
          Enter
        </kbd>
      </label>
      {error && (
        <p role="alert" className="px-1 text-sm text-danger-text">
          {error}
        </p>
      )}
    </form>
  )
}
