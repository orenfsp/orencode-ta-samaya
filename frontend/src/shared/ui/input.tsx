import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react'
import { cn } from '@/shared/lib'
import { controlClass, controlSize, useField } from './field-context'
import { IconEye, IconEyeOff } from './icons'

interface ControlProps {
  id?: string
  required?: boolean
  'aria-describedby'?: string
  'aria-invalid'?: ComponentProps<'input'>['aria-invalid']
}

/** Связь с Field: id, описания, ошибка, обязательность — без ручной проводки в каждой форме */
function useControlProps(props: ControlProps, counterId?: string) {
  const field = useField()
  const describedBy = [props['aria-describedby'] ?? field?.describedBy, counterId].filter(Boolean).join(' ')
  return {
    control: {
      id: props.id ?? field?.id,
      required: undefined,
      'aria-required': props.required ?? field?.required ?? undefined,
      'aria-describedby': describedBy || undefined,
      'aria-invalid': props['aria-invalid'] ?? (field?.invalid || undefined),
    },
    size: field?.size ?? 'md',
  }
}

function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  return (
    <span id={id} className={cn('self-end text-xs', length > max ? 'text-danger-text' : 'text-muted')}>
      {length} / {max}
    </span>
  )
}

/** Счётчик — только вместе с maxLength: технический предел без него человеку не нужен */
function useCounter(counter: boolean | undefined, maxLength: number | undefined, value: unknown) {
  const fieldId = useField()?.id
  if (!counter || maxLength === undefined) return null
  const length = typeof value === 'string' ? value.length : 0
  return { id: `${fieldId ?? 'field'}-counter`, length, max: maxLength }
}

export interface InputProps extends ComponentProps<'input'> {
  leftIcon?: ReactNode
  rightSlot?: ReactNode
  counter?: boolean
}

/** ref приходит обычным пропом (React 19), поэтому {...register('login')} работает напрямую */
export function Input({ className, leftIcon, rightSlot, counter, ...props }: InputProps) {
  const count = useCounter(counter, props.maxLength, props.value)
  const { control, size } = useControlProps(props, count?.id)
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted">
            {leftIcon}
          </span>
        )}
        <input
          {...props}
          {...control}
          className={cn(
            controlClass,
            controlSize[size],
            leftIcon && 'pl-11',
            rightSlot && 'pr-12',
            className,
          )}
        />
        {rightSlot && <span className="absolute inset-y-0 right-1 grid place-items-center">{rightSlot}</span>}
      </div>
      {count && <Counter {...count} />}
    </div>
  )
}

export function PasswordInput(props: Omit<InputProps, 'type' | 'rightSlot'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      autoComplete="current-password"
      {...props}
      type={visible ? 'text' : 'password'}
      rightSlot={
        <button
          type="button"
          // mousedown не забирает фокус у поля: курсор остаётся там, где печатали
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={visible}
          className="grid size-9 pressable place-items-center rounded-sm text-muted hover:bg-hover-tint hover:text-ink"
        >
          {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      }
    />
  )
}

export interface TextareaProps extends ComponentProps<'textarea'> {
  /** Растёт по содержимому от minRows до maxRows, дальше — скролл */
  autoGrow?: boolean
  minRows?: number
  maxRows?: number
  counter?: boolean
}

export function Textarea({
  className,
  autoGrow = false,
  minRows = 3,
  maxRows = 12,
  counter,
  ref,
  ...props
}: TextareaProps) {
  const own = useRef<HTMLTextAreaElement | null>(null)
  const count = useCounter(counter, props.maxLength, props.value)
  const { control, size } = useControlProps(props, count?.id)

  // Авторост по scrollHeight: field-sizing поддержан не везде
  useLayoutEffect(() => {
    const node = own.current
    if (!autoGrow || !node) return
    const style = window.getComputedStyle(node)
    const line = Number.parseFloat(style.lineHeight) || 24
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight + 2, line * maxRows + padding)}px`
  }, [autoGrow, props.value, maxRows])

  return (
    <div className="flex flex-col gap-1">
      <textarea
        rows={minRows}
        {...props}
        {...control}
        ref={(node) => {
          own.current = node
          assignRef(ref, node)
        }}
        className={cn(controlClass, controlSize[size], autoGrow ? 'resize-none' : 'resize-y', className)}
      />
      {count && <Counter {...count} />}
    </div>
  )
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}
