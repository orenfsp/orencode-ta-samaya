import { cn } from '@/shared/lib'
import { formatMonths } from '../../lib/describe'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame, visualItemClass } from './visual-frame'

/** Сроки судейских категорий на одной оси лет: видно, какая категория требует подтверждения чаще */
export function JudgeValidity({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  const longest = Math.max(...active.map((item) => item.validity_months ?? 0), 12)
  const axisYears = Math.ceil(longest / 12) + 1
  const percent = (months: number) => `${(months / (axisYears * 12)) * 100}%`

  return (
    <VisualFrame label="Сроки судейских категорий" note="Срок отсчитывается от даты присвоения категории.">
      <div className="flex flex-col gap-3">
        {active.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              visualItemClass,
              'group grid grid-cols-1 items-center gap-1.5 text-left sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4',
            )}
          >
            <span className="truncate text-sm text-ink" title={item.name}>
              {item.name}
            </span>
            <span className="relative flex h-7 items-center">
              {item.validity_months ? (
                <span
                  style={{ width: percent(item.validity_months), animationDelay: `${index * 80}ms` }}
                  className="flex h-full origin-left animate-grow items-center justify-end rounded-sm bg-primary px-2 font-mono text-xs whitespace-nowrap text-white transition-colors group-hover:bg-primary-hover"
                >
                  {formatMonths(item.validity_months)}
                </span>
              ) : (
                <span
                  style={{ animationDelay: `${index * 80}ms` }}
                  className="flex h-full w-full origin-left animate-grow items-center justify-end rounded-sm border border-dashed border-line px-2 font-mono text-xs text-muted"
                >
                  бессрочно
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="hidden grid-cols-[14rem_minmax(0,1fr)] gap-4 sm:grid">
        <span className="font-mono text-xs text-muted">срок, лет</span>
        <span className="relative h-4 border-t border-line-soft">
          {Array.from({ length: axisYears + 1 }, (_, year) => (
            <span
              key={year}
              style={{ left: percent(year * 12) }}
              className="absolute top-1 -translate-x-1/2 font-mono text-xs text-muted"
            >
              {year}
            </span>
          ))}
        </span>
      </div>
    </VisualFrame>
  )
}
