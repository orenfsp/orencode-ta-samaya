import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconChevronDown, IconChevronUp } from './icons'
import { Skeleton } from './skeleton'

export type SortDir = 'asc' | 'desc'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Число, дата, баллы — по правому краю моноширинным */
  align?: 'left' | 'right'
  /** Ширина колонки: 'w-40', 'w-24' */
  width?: string
  sortable?: boolean
  /** Прячем колонку на узких экранах таблицы; на телефоне карточкой показываются все */
  hideBelow?: 'lg' | 'xl'
  /** Заголовок строки-карточки на телефоне */
  primary?: boolean
  /** Действия: на телефоне — внизу карточки без подписи */
  actions?: boolean
}

const hidden = { lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

/** Клик по ссылке или кнопке внутри строки — это их действие, а не открытие строки */
const fromControl = (event: MouseEvent | KeyboardEvent) =>
  Boolean((event.target as HTMLElement).closest('a, button, input, select, label, [role="menuitem"]'))

/**
 * Список записей — таблицей: журнал, модерация, реестры, документы, рейтинг.
 * Сортировка — заголовком колонки, строка целиком открывает детали. От md — таблица, на телефоне — карточки.
 * Загрузка и пусто встроены: та же форма, что у данных.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSort,
  loading,
  skeletonRows = 8,
  empty,
  highlight,
  caption,
  className,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  sort?: { key: string; dir: SortDir }
  onSort?: (key: string, dir: SortDir) => void
  loading?: boolean
  skeletonRows?: number
  /** EmptyState без Card: обёртка уже есть */
  empty?: ReactNode
  /** Своя строка («Вы»): подсвечена синим */
  highlight?: (row: T) => boolean
  /** Подпись для скринридера */
  caption?: string
  className?: string
}) {
  const open = (row: T) => (event: MouseEvent | KeyboardEvent) => {
    if (!onRowClick || fromControl(event)) return
    if ('key' in event && event.key !== 'Enter') return
    onRowClick(row)
  }
  const primary = columns.find((column) => column.primary) ?? columns[0]!
  const actions = columns.filter((column) => column.actions)
  const details = columns.filter((column) => column !== primary && !column.actions)

  const header = (column: Column<T>) => {
    const active = sort?.key === column.key
    if (!column.sortable || !onSort) return column.header
    const next: SortDir = active && sort?.dir === 'desc' ? 'asc' : 'desc'
    return (
      <button
        type="button"
        onClick={() => onSort(column.key, next)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:field-focus',
          active && 'text-ink',
          column.align === 'right' && 'flex-row-reverse',
        )}
      >
        {column.header}
        {active && sort?.dir === 'asc' ? (
          <IconChevronUp size={14} />
        ) : (
          <IconChevronDown size={14} className={active ? undefined : 'opacity-40'} />
        )}
      </button>
    )
  }

  if (!loading && !rows.length) return <div className={cn('card', className)}>{empty}</div>

  return (
    <div className={cn('overflow-hidden card', className)} aria-busy={loading}>
      <table className="hidden w-full border-collapse text-left text-body md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-line-soft bg-surface-3/60">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={
                  sort?.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                }
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5',
                  column.align === 'right' && 'text-right',
                  column.width,
                  column.hideBelow && hidden[column.hideBelow],
                )}
              >
                {header(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {loading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-4 first:pl-5 last:pr-5',
                        column.hideBelow && hidden[column.hideBelow],
                      )}
                    >
                      <Skeleton className={cn('h-4 rounded-sm', column.primary ? 'w-48' : 'w-20')} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? open(row) : undefined}
                  onKeyDown={onRowClick ? open(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick &&
                      'cursor-pointer hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:outline-none',
                    highlight?.(row) && 'bg-primary-soft hover:bg-primary-soft',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle text-ink first:pl-5 last:pr-5',
                        column.align === 'right' && 'text-right font-mono tabular-nums',
                        column.actions && 'text-right whitespace-nowrap',
                        column.hideBelow && hidden[column.hideBelow],
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line-soft md:hidden">
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 4) }, (_, index) => (
              <li key={index} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-48 rounded-sm" />
                <Skeleton className="h-3 w-32 rounded-sm" />
              </li>
            ))
          : rows.map((row) => (
              <li
                key={rowKey(row)}
                onClick={onRowClick ? open(row) : undefined}
                className={cn(
                  'flex flex-col gap-3 p-4',
                  onRowClick && 'cursor-pointer active:bg-press-tint',
                  highlight?.(row) && 'bg-primary-soft',
                )}
              >
                <div className="min-w-0 text-ink">{primary.cell(row)}</div>
                {details.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {details.map((column) => (
                      <div key={column.key} className="flex min-w-0 flex-col gap-0.5">
                        <dt className="text-xs text-muted">{column.header}</dt>
                        <dd className="min-w-0 break-words text-ink">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((column) => (
                      <div key={column.key}>{column.cell(row)}</div>
                    ))}
                  </div>
                )}
              </li>
            ))}
      </ul>
    </div>
  )
}
