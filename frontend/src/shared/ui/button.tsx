import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-class'
import { Spinner } from './spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** Внутренняя навигация: кнопка рендерится ссылкой роутера (открывается в новой вкладке, копируется) */
  to?: string
  /** Адрес вне роутера: якорь на странице или файл с бэка (.xlsx, .pdf) */
  href?: string
  /** Внешний сайт (Telegram, почтовый ящик): открывается в новой вкладке */
  external?: boolean
}

export function Button({
  variant,
  size,
  loading = false,
  fullWidth,
  leftIcon,
  rightIcon,
  to,
  href,
  external = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = buttonClass({ variant, size, fullWidth, className })
  const content = (
    <>
      <span
        className={cn(
          'inline-flex items-center gap-[inherit] transition-opacity duration-150',
          loading && 'opacity-0',
        )}
      >
        {leftIcon}
        {children}
        {rightIcon && (
          <span className="transition-transform duration-220 ease-emphasized group-hover/button:translate-x-0.5">
            {rightIcon}
          </span>
        )}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {content}
        {external && <span className="sr-only"> (откроется в новой вкладке)</span>}
      </a>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  )
}
