import { useState } from 'react'
import { cn } from '@/shared/lib'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame } from './visual-frame'

/**
 * Уровни соревнований как круги охвата: каждый следующий шире предыдущего —
 * регион ⊂ межрегион ⊂ Россия ⊂ мир. Порядок — порядок добавления (демо-данные заведены от узкого к широкому).
 */
export function LevelRings({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  const size = 280
  const center = size / 2
  const step = (center - 18) / active.length
  const current = active.find((item) => item.id === hover)

  return (
    <VisualFrame label="Уровни соревнований" note="Наведите на круг или выберите уровень в списке.">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-64 shrink-0"
          onMouseLeave={() => setHover(null)}
        >
          {[...active].reverse().map((item, reversedIndex) => {
            const index = active.length - 1 - reversedIndex
            const radius = step * (index + 1)
            const focused = hover === item.id
            return (
              <circle
                key={item.id}
                cx={center}
                cy={center}
                r={radius}
                role="button"
                tabIndex={0}
                aria-label={item.name}
                onMouseEnter={() => setHover(item.id)}
                onFocus={() => setHover(item.id)}
                onClick={() => onSelect(item)}
                onKeyDown={(event) => event.key === 'Enter' && onSelect(item)}
                style={{ animationDelay: `${index * 120}ms`, transformOrigin: 'center' }}
                className={cn(
                  'animate-rise cursor-pointer transition-[fill,stroke] duration-220 outline-none',
                  index === 0 ? 'fill-primary' : focused ? 'fill-primary/25' : 'fill-canvas',
                  focused ? 'stroke-primary' : 'stroke-line',
                )}
                strokeWidth={1.25}
              />
            )
          })}
        </svg>

        <ol className="flex w-full flex-col gap-1">
          {active.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setHover(item.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(item)}
                className={cn(
                  'flex w-full items-baseline gap-3 rounded-sm px-2 py-1.5 text-left transition-colors duration-150',
                  hover === item.id ? 'bg-hover-tint text-ink' : 'text-muted hover:text-ink',
                )}
              >
                <span className="font-mono text-xs">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-body">{item.name}</span>
              </button>
            </li>
          ))}
          <li className="min-h-10 px-2 pt-2 text-sm text-muted">{current?.description}</li>
        </ol>
      </div>
    </VisualFrame>
  )
}
