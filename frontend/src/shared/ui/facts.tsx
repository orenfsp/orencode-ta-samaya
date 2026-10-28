import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

export interface Fact {
  label: string
  value: ReactNode
}

/**
 * Пары «подпись — значение»: карточка соревнования, справка, детали записи журнала.
 * stack — подпись над значением (узкая колонка), row — подпись слева (широкий блок, окно с деталями).
 */
export function Facts({
  items,
  layout = 'row',
  className,
}: {
  items: (Fact | false | null | undefined)[]
  layout?: 'row' | 'stack'
  className?: string
}) {
  const shown = items.filter(Boolean) as Fact[]
  return (
    <dl
      className={cn(
        layout === 'row' ? 'flex flex-col divide-y divide-line-soft' : 'flex flex-col gap-4',
        className,
      )}
    >
      {shown.map((item) => (
        <div
          key={item.label}
          className={
            layout === 'row'
              ? 'grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4'
              : 'flex flex-col gap-1'
          }
        >
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="min-w-0 break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
