import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { Breadcrumbs, type Crumb } from './breadcrumbs'

/** Шапка раздела кабинета: те же хлебные крошки, что на сайте, заголовок, пояснение и действия справа */
export function PageHeader({
  crumbs,
  title,
  description,
  actions,
  className,
}: {
  crumbs?: Crumb[]
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-5', className)}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-h1 font-medium text-balance">{title}</h1>
          {description && <p className="max-w-2xl text-body text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
