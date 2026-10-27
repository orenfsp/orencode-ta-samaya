import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/shared/lib'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** segmented — плашка на подложке, underline — линия под активной вкладкой */
  variant?: 'segmented' | 'underline'
  fullWidth?: boolean
  'aria-label'?: string
  className?: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'segmented',
  fullWidth,
  className,
  ...aria
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  // Индикатор ездит за активной вкладкой: меряем её положение после раскладки
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"]')
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [value, items])

  const enabled = items.filter((item) => !item.disabled)

  const onKeyDown = (event: KeyboardEvent) => {
    const index = enabled.findIndex((item) => item.value === value)
    const next =
      event.key === 'ArrowRight'
        ? enabled[(index + 1) % enabled.length]
        : event.key === 'ArrowLeft'
          ? enabled[(index - 1 + enabled.length) % enabled.length]
          : event.key === 'Home'
            ? enabled[0]
            : event.key === 'End'
              ? enabled[enabled.length - 1]
              : undefined
    if (!next) return
    event.preventDefault()
    onChange(next.value)
    listRef.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus()
  }

  const segmented = variant === 'segmented'

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'relative isolate flex max-w-full [scrollbar-width:none] overflow-x-auto',
        segmented
          ? 'inline-flex gap-1 rounded-md bg-surface-2 p-1 light:bg-surface-3'
          : 'gap-6 border-b border-line-soft',
        fullWidth && 'w-full',
        className,
      )}
      {...aria}
    >
      {indicator && (
        <span
          aria-hidden="true"
          style={{ translate: `${indicator.left}px 0`, width: indicator.width }}
          className={cn(
            'absolute left-0 -z-10 transition-[translate,width] duration-340 ease-emphasized',
            segmented ? 'inset-y-1 rounded-sm bg-primary' : 'bottom-0 h-0.5 rounded-full bg-primary',
          )}
        />
      )}
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-value={item.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'shrink-0 pressable text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40',
              segmented ? 'h-9 rounded-sm px-4' : 'h-11',
              fullWidth && 'flex-1',
              selected ? (segmented ? 'text-white' : 'text-ink') : 'text-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
