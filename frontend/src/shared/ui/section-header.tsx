import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

/** Заголовок блока на странице: h2 слева, действие справа («Все», «Показать всё») на одной линии */
export function SectionHeader({
  title,
  description,
  action,
  as: Tag = 'h2',
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Tag className={cn('font-medium text-ink', Tag === 'h2' ? 'text-h2' : 'text-h3')}>{title}</Tag>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
