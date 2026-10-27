import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn, formatNumber } from '@/shared/lib'
import { Avatar } from './avatar'

/** Занятое место. Призовые выделены: 1 — синий, 2 — тёмный/светлый по теме, 3 — красный контур */
export function PlaceMark({
  place,
  size = 'md',
  className,
}: {
  place: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-label={`${place} место`}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-md font-mono tabular-nums',
        size === 'lg' ? 'size-12 text-h3' : size === 'md' ? 'size-9 text-body' : 'size-7 text-sm',
        place === 1 && 'bg-primary text-white',
        place === 2 && 'bg-ink text-canvas',
        place === 3 && 'border-2 border-live text-live-text',
        place > 3 && 'text-muted',
        className,
      )}
    >
      {place}
    </span>
  )
}

export interface RankingRow {
  id: string
  place: number
  name: string
  avatar?: string | null
  /** Под именем: муниципалитет, организация, разряд */
  meta?: ReactNode
  points: number
  to?: string
}

/**
 * Рейтинг одной группы (дисциплина + возрастная/академическая группа).
 * Первые topCount — крупными строками, следующие — тонкими. Остальное обрезается: полная таблица — отдельно.
 */
export function RankingList({
  title,
  caption,
  rows,
  topCount = 5,
  restCount = 10,
  className,
}: {
  title?: ReactNode
  caption?: ReactNode
  rows: RankingRow[]
  topCount?: number
  restCount?: number
  className?: string
}) {
  const top = rows.slice(0, topCount)
  const rest = rows.slice(topCount, topCount + restCount)

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {(title || caption) && (
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title && <h3 className="text-h3 font-medium">{title}</h3>}
          {caption && <span className="text-sm text-muted">{caption}</span>}
        </header>
      )}
      {!rows.length ? (
        <p className="rounded-lg border border-line-soft px-5 py-6 text-sm text-muted">
          В этой группе пока нет результатов
        </p>
      ) : (
        <ol className="flex flex-col overflow-hidden rounded-lg border border-line-soft">
          {top.map((row) => (
            <li key={row.id} className="border-b border-line-soft last:border-b-0">
              <Row row={row} big />
            </li>
          ))}
          {rest.map((row) => (
            <li
              key={row.id}
              className="border-b border-line-soft bg-surface-2 last:border-b-0 light:bg-canvas"
            >
              <Row row={row} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Row({ row, big = false }: { row: RankingRow; big?: boolean }) {
  const name = row.to ? (
    <Link to={row.to} className="truncate hover:text-primary-text">
      {row.name}
    </Link>
  ) : (
    <span className="truncate">{row.name}</span>
  )
  return (
    <div className={cn('flex items-center gap-3 sm:gap-4', big ? 'px-4 py-4 sm:px-5' : 'px-4 py-2 sm:px-5')}>
      <PlaceMark place={row.place} size={big ? 'lg' : 'sm'} />
      {big && <Avatar name={row.name} src={row.avatar} size="md" className="hidden sm:inline-grid" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('flex min-w-0 text-ink', big ? 'text-lead font-medium' : 'text-sm')}>{name}</span>
        {big && row.meta && <span className="truncate text-sm text-muted">{row.meta}</span>}
      </div>
      <span
        className={cn('shrink-0 font-mono tabular-nums', big ? 'text-h3 text-ink' : 'text-sm text-muted')}
      >
        {formatNumber(row.points)}
      </span>
    </div>
  )
}
