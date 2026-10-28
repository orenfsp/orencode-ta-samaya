import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

/**
 * Строка над списком: поиск растягивается, фильтры и порядок — справа фиксированной ширины.
 * На телефоне поиск на всю ширину, ниже контролы по два в ряд — тулбар не разъезжается лесенкой.
 */
export function Toolbar({
  search,
  children,
  end,
  className,
}: {
  /** Поле поиска: занимает всё свободное место */
  search?: ReactNode
  /** Фильтры: каждый — Field с Select или DateInput */
  children?: ReactNode
  /** Сброс фильтров, счётчик «N найдено» */
  end?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-line-soft bg-surface p-3 sm:p-4 lg:flex-row lg:items-end',
        className,
      )}
    >
      {search && <div className="min-w-0 lg:flex-1">{search}</div>}
      {children && (
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end lg:flex-nowrap [&>*]:min-w-0 sm:[&>*]:w-48">
          {children}
        </div>
      )}
      {end && <div className="flex items-center gap-3 lg:ml-auto lg:min-h-11">{end}</div>}
    </div>
  )
}
