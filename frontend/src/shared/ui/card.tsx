import type { HTMLAttributes } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Вся карточка — ссылка: при наведении приподнимается, рамка становится синей */
  to?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }

const interactive =
  'block transition-[translate,background-color,box-shadow] duration-220 ease-emphasized hover:-translate-y-0.5 hover:bg-surface-3 hover:[--c-card-border:var(--c-primary)] light:hover:bg-surface active:translate-y-0 active:duration-90'

export function Card({ to, padding = 'md', className, children, ...props }: CardProps) {
  const classes = cn('card', paddings[padding], to && interactive, className)

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}
