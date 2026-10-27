import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { FieldContext, type FieldSize } from './field-context'
import { IconAlert } from './icons'

export interface FieldProps {
  label: ReactNode
  /** Контрол справа от подписи: «Забыли пароль?» */
  labelEnd?: ReactNode
  /** Что писать и почему — под полем */
  hint?: ReactNode
  error?: ReactNode
  /**
   * Звёздочка и aria-required. Нативный required не ставим:
   * браузерный пузырь спорил бы с нашей валидацией формы
   */
  required?: boolean
  size?: FieldSize
  className?: string
  children: ReactNode
}

export function Field({
  label,
  labelEnd,
  hint,
  error,
  required = false,
  size = 'md',
  className,
  children,
}: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  // Подсказка и ошибка — одним aria-describedby, иначе скринридер скажет «недопустимо» без объяснения
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required, size }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm text-muted">
            {label}
            {required && (
              <span className="text-muted" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
          {labelEnd}
        </div>
        {children}
        {hint && (
          <p id={hintId} className="text-sm text-muted">
            {hint}
          </p>
        )}
        {/* Высота анимируется через grid-rows: появление ошибки не дёргает форму */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-220 ease-emphasized',
            error ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            {/* Ошибка приходит по ходу ввода — её объявляют, а не только показывают */}
            {error && (
              <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
                <IconAlert size={16} className="mt-px shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </FieldContext.Provider>
  )
}
