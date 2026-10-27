import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib'
import { controlClass, controlSize, useField } from './field-context'
import { IconChevronDown } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends ComponentProps<'select'> {
  options: SelectOption[]
  placeholder?: string
}

/**
 * Нативный select: на телефоне открывается системный список, доступность — из коробки.
 * Для длинных справочников с поиском (организации, муниципалитеты) — SearchSelect.
 */
export function Select({ options, placeholder, className, required, ...props }: SelectProps) {
  const field = useField()
  const isRequired = required ?? field?.required
  return (
    <div className="group relative">
      <select
        {...props}
        id={props.id ?? field?.id}
        aria-required={isRequired || undefined}
        aria-describedby={props['aria-describedby'] ?? field?.describedBy}
        aria-invalid={props['aria-invalid'] ?? (field?.invalid || undefined)}
        className={cn(
          controlClass,
          controlSize[field?.size ?? 'md'],
          'cursor-pointer appearance-none pr-9',
          className,
        )}
      >
        {placeholder && (
          <option value="" disabled={isRequired}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={18}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted transition-transform duration-220 ease-emphasized group-focus-within:rotate-180 group-focus-within:text-ink"
      />
    </div>
  )
}
