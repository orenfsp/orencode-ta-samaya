import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconClose, IconFile, IconUpload } from './icons'

export interface FileDropProps {
  label: ReactNode
  hint?: ReactNode
  /** Например, "application/pdf" или ".pdf,.jpg" */
  accept?: string
  maxSizeMb?: number
  value: File | null
  onChange: (file: File | null) => void
  error?: ReactNode
  className?: string
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} КБ`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true
  return accept.split(',').some((rule) => {
    const pattern = rule.trim().toLowerCase()
    if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern)
    if (pattern.endsWith('/*')) return file.type.startsWith(pattern.slice(0, -1))
    return file.type === pattern
  })
}

/** Загрузка одного файла: перетаскиванием или выбором. Тип и размер проверяем сразу, до отправки */
export function FileDrop({
  label,
  hint,
  accept,
  maxSizeMb = 10,
  value,
  onChange,
  error,
  className,
}: FileDropProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const shownError = error ?? localError

  const pick = (file: File | undefined) => {
    if (!file) return
    if (!matchesAccept(file, accept)) return setLocalError('Этот тип файла не подходит')
    if (file.size > maxSizeMb * 1024 * 1024) return setLocalError(`Файл больше ${maxSizeMb} МБ`)
    setLocalError(null)
    onChange(file)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files[0])
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {value ? (
        <div className="flex animate-pop-in items-center gap-3 card p-3 pr-2">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-ink">
            <IconFile />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body text-ink">{value.name}</span>
            <span className="text-sm text-muted">{formatSize(value.size)}</span>
          </div>
          <button
            type="button"
            aria-label="Убрать файл"
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="grid size-9 pressable place-items-center rounded-sm text-muted hover:bg-hover-tint hover:text-ink"
          >
            <IconClose size={18} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'group flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center',
            'transition-[background-color,border-color,scale] duration-220 ease-emphasized has-focus-visible:field-focus',
            dragging
              ? 'scale-[1.01] border-primary bg-primary-soft'
              : 'border-line bg-surface-2 hover:border-primary hover:bg-primary-soft/50',
            shownError && !dragging && 'border-danger',
          )}
        >
          <span
            className={cn(
              'grid size-12 place-items-center rounded-full bg-surface-3 text-ink transition-[translate,background-color,color] duration-340 ease-spring',
              'group-hover:-translate-y-1 group-hover:bg-primary group-hover:text-white',
              dragging && '-translate-y-1 bg-primary text-white',
            )}
          >
            <IconUpload />
          </span>
          <span className="text-body text-ink">
            <span className="font-medium underline decoration-line underline-offset-4">Выберите файл</span>{' '}
            или перетащите сюда
          </span>
          {hint && <span className="text-sm text-muted">{hint}</span>}
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </label>
      )}

      {shownError && <p className="text-sm text-danger-text">{shownError}</p>}
    </div>
  )
}
