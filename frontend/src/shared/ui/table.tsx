import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/shared/lib'

/** Обёртка скроллит таблицу по горизонтали на телефоне, а не всю страницу */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto card">
      <table className={cn('w-full border-collapse text-left text-body', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-line-soft bg-surface-3/50', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line-soft', className)} {...props} />
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors duration-150 hover:bg-hover-tint/50', className)} {...props} />
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-sm font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3.5 align-middle text-ink first:pl-5 last:pr-5', className)} {...props} />
}
