import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'
import { IconExternal } from './icons'

type Level = 1 | 2 | 3

const levels: Record<Level, string> = {
  1: 'text-h1 font-medium',
  2: 'text-h2 font-medium',
  3: 'text-h3 font-medium',
}

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: Level
  /** Визуальный размер, если он не совпадает с уровнем в структуре страницы */
  look?: Level
}

export function Heading({ level = 2, look, className, ...props }: HeadingProps) {
  const Tag = `h${level}` as const
  return <Tag className={cn('text-balance text-ink', levels[look ?? level], className)} {...props} />
}

/** Короткая подпись над заголовком секции */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

export interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Внутренняя ссылка — через роутер */
  to?: string
  children: ReactNode
}

/** Внешняя ссылка (href на другой домен) сама открывается в новой вкладке и получает иконку «наружу» */
export function TextLink({ to, href, className, children, ...props }: TextLinkProps) {
  const classes = cn(
    'inline-flex items-center gap-1 text-ink underline decoration-line underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  const external = href ? /^https?:\/\//.test(href) && !href.startsWith(window.location.origin) : false

  return (
    <a
      href={href}
      className={classes}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      {...props}
    >
      {children}
      {external && (
        <>
          <IconExternal size={14} className="shrink-0" />
          <span className="sr-only"> (откроется в новой вкладке)</span>
        </>
      )}
    </a>
  )
}
