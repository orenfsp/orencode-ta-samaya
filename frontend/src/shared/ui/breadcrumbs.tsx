import { Link } from 'react-router'
import { cn } from '@/shared/lib'
import { IconChevronRight } from './icons'

export interface Crumb {
  label: string
  to?: string
}

/** Последний пункт — текущая страница, без ссылки */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Хлебные крошки" className={cn('min-w-0', className)}>
      {/* Длинное название текущей страницы обрезается многоточием, а не уезжает за край */}
      <ol className="flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li
              key={`${item.label}-${index}`}
              className={cn('flex items-center gap-1.5', last ? 'min-w-0' : 'shrink-0')}
            >
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className="link-underline text-muted transition-colors duration-150 hover:text-ink"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  title={item.label}
                  className="truncate text-ink"
                >
                  {item.label}
                </span>
              )}
              {!last && <IconChevronRight size={14} className="text-line" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
