import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'
import { Button } from './button'
import { IconChevronLeft, IconChevronRight } from './icons'

const GAP = '…'

/** Первая, окно ±1 вокруг текущей, последняя — длинный ряд номеров читается хуже короткого с многоточием */
function pageRange(page: number, total: number): (number | typeof GAP)[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = [...new Set([1, page - 1, page, page + 1, total])]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b)
  const result: (number | typeof GAP)[] = []
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1]! > 1) result.push(GAP)
    result.push(value)
  })
  return result
}

export interface PaginationProps {
  page: number
  totalPages: number
  /** Адрес страницы: состояние списка живёт в URL, F5 и «Назад» работают */
  hrefFor: (page: number) => string
  /** Догрузка на телефоне. Нет — кнопка не показывается */
  onMore?: () => void
  moreLoading?: boolean
  className?: string
}

const cell =
  'grid size-10 place-items-center rounded-md text-body transition-[background-color,color,scale] duration-150 ease-standard'

/**
 * На десктопе — номера страниц, на телефоне — «Показать ещё» (кит: без бесконечного скролла).
 * Оба контрола всегда в DOM, лишний прячет CSS: ветвление по ширине в разметке дёргало бы раскладку.
 */
export function Pagination({ page, totalPages, hrefFor, onMore, moreLoading, className }: PaginationProps) {
  if (totalPages <= 1) return null
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const arrow = (target: number, enabled: boolean, label: string, icon: ReactNode) =>
    enabled ? (
      <Link to={hrefFor(target)} aria-label={label} className={cn(cell, 'text-ink hover:bg-surface-3')}>
        {icon}
      </Link>
    ) : (
      <span aria-hidden="true" className={cn(cell, 'text-muted opacity-40')}>
        {icon}
      </span>
    )

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <nav aria-label="Страницы" className="hidden items-center gap-1 md:flex">
        {arrow(page - 1, hasPrev, 'Предыдущая страница', <IconChevronLeft size={18} />)}
        {pageRange(page, totalPages).map((item, index) =>
          item === GAP ? (
            <span key={`gap-${index}`} aria-hidden="true" className="w-6 text-center text-muted select-none">
              {GAP}
            </span>
          ) : (
            <Link
              key={item}
              to={hrefFor(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={item === page ? `Текущая страница, ${item}` : `Страница ${item}`}
              className={cn(
                cell,
                'active:scale-95',
                item === page ? 'bg-primary text-white' : 'text-muted hover:bg-surface-3 hover:text-ink',
              )}
            >
              {item}
            </Link>
          ),
        )}
        {arrow(page + 1, hasNext, 'Следующая страница', <IconChevronRight size={18} />)}
      </nav>
      {onMore && hasNext && (
        <Button variant="secondary" fullWidth className="md:hidden" loading={moreLoading} onClick={onMore}>
          Показать ещё
        </Button>
      )}
    </div>
  )
}
