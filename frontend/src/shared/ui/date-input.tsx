import { useRef, useState } from 'react'
import { cn } from '@/shared/lib'
import {
  formatDateText,
  maskDate,
  maskTime,
  MAX_YEAR,
  MIN_YEAR,
  monthGrid,
  monthNames,
  parseDate,
  parseTime,
  todayIso,
  weekdayNames,
} from './date-parts'
import { useField } from './field-context'
import { IconButton } from './icon-button'
import { IconCalendar, IconChevronLeft, IconChevronRight } from './icons'
import { Input, type InputProps } from './input'
import { Popover } from './popover'

type BaseProps = Omit<InputProps, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'defaultValue'>

export interface DateInputProps extends BaseProps {
  /** «гггг-мм-дд» или пустая строка */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

/**
 * Текст держим свой: пока дата не введена целиком, наружу уходит пустая строка,
 * а набранное не стирается. Новое значение снаружи перезаписывает текст.
 */
function useMasked(value: string, toText: (value: string) => string, parse: (text: string) => string | null) {
  const [text, setText] = useState(() => toText(value))
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    if (value !== (parse(text) ?? '')) setText(toText(value))
  }
  const update = (next: string) => {
    setText(next)
    const parsed = parse(next) ?? ''
    setSynced(parsed)
    return parsed
  }
  return [text, update] as const
}

function CalendarPanel({
  value,
  min,
  max,
  onPick,
}: {
  value: string
  min?: string
  max?: string
  onPick: (iso: string) => void
}) {
  const start = value || todayIso()
  const [view, setView] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) - 1 })
  const today = todayIso()
  const move = (offset: number) =>
    setView(({ year, month }) => {
      const next = year * 12 + month + offset
      return { year: Math.floor(next / 12), month: next % 12 }
    })
  const lower = min ?? `${MIN_YEAR}-01-01`
  const upper = max ?? `${MAX_YEAR}-12-31`

  return (
    <div className="flex w-72 flex-col gap-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <IconButton
          aria-label="Предыдущий месяц"
          icon={<IconChevronLeft size={18} />}
          size="sm"
          disabled={view.year <= MIN_YEAR && view.month === 0}
          onClick={() => move(-1)}
        />
        <span className="font-mono text-sm text-ink" aria-live="polite">
          {monthNames[view.month]} {view.year}
        </span>
        <IconButton
          aria-label="Следующий месяц"
          icon={<IconChevronRight size={18} />}
          size="sm"
          disabled={view.year >= MAX_YEAR && view.month === 11}
          onClick={() => move(1)}
        />
      </div>
      <div className="grid grid-cols-7 text-center font-mono text-xs text-muted">
        {weekdayNames.map((name) => (
          <span key={name} className="py-1">
            {name}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthGrid(view.year, view.month).map((cell) => {
          const selected = cell.iso === value
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={cell.iso < lower || cell.iso > upper}
              aria-pressed={selected}
              aria-label={formatDateText(cell.iso)}
              onClick={() => onPick(cell.iso)}
              className={cn(
                'grid h-9 place-items-center rounded-sm font-mono text-sm transition-colors duration-150',
                cell.inMonth ? 'text-ink' : 'text-muted',
                'hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
                cell.iso === today && !selected && 'ring-1 ring-line ring-inset',
                selected && 'bg-primary text-white hover:bg-primary',
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="self-start rounded-sm px-2 py-1 text-sm text-ink transition-colors hover:bg-surface-3"
        onClick={() => onPick(today)}
      >
        Сегодня
      </button>
    </div>
  )
}

/** Дата «дд.мм.гггг»: ввод с клавиатуры по маске или выбор в календаре. Язык браузера не важен */
export function DateInput({ value, onChange, min, max, disabled, placeholder, ...props }: DateInputProps) {
  const [text, setText] = useMasked(value, formatDateText, parseDate)
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const emit = (next: string) => {
    if (next !== value) onChange(next)
  }

  return (
    <div ref={anchorRef}>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={placeholder ?? 'дд.мм.гггг'}
        disabled={disabled}
        value={text}
        onChange={(event) => emit(setText(maskDate(event.target.value)))}
        rightSlot={
          <IconButton
            aria-label="Выбрать в календаре"
            data-no-tooltip
            icon={<IconCalendar size={18} />}
            size="sm"
            disabled={disabled}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          />
        }
      />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" align="end">
        {open && (
          <CalendarPanel
            value={value}
            min={min}
            max={max}
            onPick={(iso) => {
              emit(setText(formatDateText(iso)))
              setOpen(false)
            }}
          />
        )}
      </Popover>
    </div>
  )
}

export interface TimeInputProps extends BaseProps {
  /** «чч:мм» или пустая строка */
  value: string
  onChange: (value: string) => void
}

export function TimeInput({ value, onChange, placeholder, ...props }: TimeInputProps) {
  const [text, setText] = useMasked(value, (time) => time, parseTime)
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={placeholder ?? 'чч:мм'}
      value={text}
      onChange={(event) => {
        const next = setText(maskTime(event.target.value))
        if (next !== value) onChange(next)
      }}
    />
  )
}

export interface DateTimeInputProps {
  /** «гггг-мм-ддTчч:мм» или пустая строка, пока не заполнены и дата, и время */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
}

/** Дата и время рядом. Подпись Field относится к дате, у времени своя скрытая подпись */
export function DateTimeInput({ value, onChange, min, max, disabled }: DateTimeInputProps) {
  const field = useField()
  const [parts, setParts] = useState(() => ({ date: value.slice(0, 10), time: value.slice(11, 16) }))
  const [synced, setSynced] = useState(value)
  const combined = parts.date && parts.time ? `${parts.date}T${parts.time}` : ''
  if (value !== synced) {
    setSynced(value)
    if (value !== combined) setParts({ date: value.slice(0, 10), time: value.slice(11, 16) })
  }
  const update = (next: { date: string; time: string }) => {
    setParts(next)
    const joined = next.date && next.time ? `${next.date}T${next.time}` : ''
    setSynced(joined)
    if (joined !== value) onChange(joined)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
      <DateInput
        value={parts.date}
        min={min?.slice(0, 10)}
        max={max?.slice(0, 10)}
        disabled={disabled}
        onChange={(date) => update({ ...parts, date })}
      />
      <TimeInput
        id={field ? `${field.id}-time` : undefined}
        aria-label="Время"
        value={parts.time}
        disabled={disabled}
        onChange={(time) => update({ ...parts, time })}
      />
    </div>
  )
}
