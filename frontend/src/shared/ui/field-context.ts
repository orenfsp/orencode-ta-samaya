import { createContext, useContext } from 'react'
import { cn } from '@/shared/lib'

export type FieldSize = 'sm' | 'md'

interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
  required: boolean
  size: FieldSize
}

export const FieldContext = createContext<FieldContextValue | null>(null)

/** Поля ввода внутри Field сами получают id, aria-describedby, aria-invalid и плотность */
export const useField = () => useContext(FieldContext)

/** Плотность — одна ось: высота, поля, ступень текста. md — форма, sm — фильтры и плотные карточки */
export const controlSize: Record<FieldSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm rounded-sm',
  md: 'min-h-11 px-3.5 py-2.5 text-body rounded-md',
}

/**
 * Общая отделка поля: input, textarea, select.
 * background-color в переходе нет: им Chrome красит автозаполнение, и переход возвращал бы его заливку.
 */
export const controlClass = cn(
  'w-full border border-field-border bg-field text-ink placeholder:text-muted',
  'transition-[border-color,box-shadow] duration-150 ease-standard',
  'hover:border-field-border-hover focus:field-focus focus:outline-none',
  'aria-invalid:field-invalid',
  'disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-surface disabled:text-muted',
)
