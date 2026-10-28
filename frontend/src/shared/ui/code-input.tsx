import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/shared/lib'
import { controlClass, useField } from './field-context'

/**
 * Код из письма: шесть ячеек. Цифра переводит фокус дальше, Backspace — назад,
 * вставка из буфера заполняет все ячейки сразу. onComplete — когда введены все цифры.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  autoFocus,
  size = 'md',
  className,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  /** lg — главное действие экрана (подтверждение почты, восстановление): крупные ячейки по центру */
  size?: 'md' | 'lg'
  className?: string
}) {
  const field = useField()
  const cells = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  const update = (next: string, focus: number) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    cells.current[Math.min(focus, length - 1)]?.focus()
    if (clean.length === length) onComplete?.(clean)
  }

  const type = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return
    // Несколько цифр в одной ячейке (набор подряд, автозаполнение) разливаются вправо, как вставка
    if (typed.length > 1) {
      update(value.slice(0, index) + typed, index + typed.length)
      return
    }
    const next = digits.slice()
    next[index] = typed
    update(next.join(''), index + 1)
  }

  const key = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const next = digits.slice()
      const target = digits[index] ? index : Math.max(0, index - 1)
      next[target] = ''
      onChange(next.join(''))
      cells.current[target]?.focus()
    } else if (event.key === 'ArrowLeft') cells.current[Math.max(0, index - 1)]?.focus()
    else if (event.key === 'ArrowRight') cells.current[Math.min(length - 1, index + 1)]?.focus()
  }

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!text) return
    event.preventDefault()
    update(text, text.length)
  }

  return (
    <div
      className={cn('flex', size === 'lg' ? 'gap-2 sm:gap-3' : 'gap-2', className)}
      role="group"
      aria-label="Код из письма"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            cells.current[index] = node
          }}
          id={index === 0 ? field?.id : undefined}
          aria-label={`Цифра ${index + 1} из ${length}`}
          aria-invalid={field?.invalid || undefined}
          aria-describedby={index === 0 ? field?.describedBy : undefined}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && index === 0}
          maxLength={length}
          disabled={disabled}
          value={digit}
          onChange={(event) => type(index, event.target.value)}
          onKeyDown={(event) => key(index, event)}
          onPaste={paste}
          onFocus={(event) => event.target.select()}
          className={cn(
            controlClass,
            'px-0 text-center font-mono tabular-nums caret-primary',
            size === 'lg'
              ? 'h-16 w-12 rounded-lg border-2 text-h2 sm:h-[4.5rem] sm:w-14'
              : 'h-14 w-11 text-h3 sm:w-12',
            digit && 'border-primary bg-primary-soft',
            index === length / 2 && (size === 'lg' ? 'ml-2 sm:ml-4' : 'ml-2'),
          )}
        />
      ))}
    </div>
  )
}
