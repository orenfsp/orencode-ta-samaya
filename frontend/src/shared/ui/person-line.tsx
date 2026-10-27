import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'
import { Avatar } from './avatar'

/**
 * Человек в списке: аватар, ФИО, строка под ним (роль, разряд, организация) и место справа под действия.
 * Одна форма для участников, тренеров, судей и членов команды — чтобы списки везде читались одинаково.
 */
export function PersonLine({
  name,
  meta,
  avatar,
  to,
  trailing,
  size = 'md',
  className,
}: {
  name: string
  meta?: ReactNode
  avatar?: string | null
  /** Ссылка на профиль: имя становится ссылкой, действия справа остаются кнопками */
  to?: string
  trailing?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar name={name} src={avatar} size={size === 'sm' ? 'sm' : 'md'} />
      <div className="flex min-w-0 flex-1 flex-col">
        {to ? (
          <Link to={to} className="truncate text-body text-ink hover:text-primary-text">
            {name}
          </Link>
        ) : (
          <span className="truncate text-body text-ink">{name}</span>
        )}
        {meta && <span className="truncate text-sm text-muted">{meta}</span>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  )
}
