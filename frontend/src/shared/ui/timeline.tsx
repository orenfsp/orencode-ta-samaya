import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

/**
 * Лента по времени для портфолио спортсмена, тренера и судьи: слева дата, по центру линия,
 * справа карточка выступления с заметкой и фото. Год выносится разделителем, когда меняется.
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn('relative flex flex-col', className)}>{children}</ol>
}

export function TimelineYear({ year }: { year: number | string }) {
  return (
    <li className="grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] items-center pt-4 pb-6 first:pt-0 sm:grid-cols-[6.5rem_2rem_minmax(0,1fr)]">
      <span className="col-span-3 font-mono text-h2 text-ink">{year}</span>
    </li>
  )
}

export function TimelineItem({
  date,
  caption,
  accent = 'primary',
  last = false,
  children,
}: {
  /** Короткая дата слева: «14 нояб.» */
  date: ReactNode
  /** Под датой: «2 дня», «судья» */
  caption?: ReactNode
  /** Точка на линии: соревнование — синяя, событие — красная, прочее — серая */
  accent?: 'primary' | 'live' | 'muted'
  last?: boolean
  children: ReactNode
}) {
  return (
    <li className="grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_2rem_minmax(0,1fr)]">
      <div className="flex flex-col items-end gap-0.5 pt-4 pr-2 text-right">
        <span className="font-mono text-sm text-ink">{date}</span>
        {caption && <span className="text-xs text-muted">{caption}</span>}
      </div>
      <div className="relative flex justify-center" aria-hidden="true">
        <span className={cn('absolute top-0 w-px bg-line-soft', last ? 'h-5' : 'bottom-0')} />
        <span
          className={cn(
            'relative mt-5 size-3 rounded-full ring-4 ring-canvas',
            accent === 'primary' ? 'bg-primary' : accent === 'live' ? 'bg-live' : 'bg-line',
          )}
        />
      </div>
      <div className={cn('min-w-0', last ? 'pb-0' : 'pb-8')}>{children}</div>
    </li>
  )
}
