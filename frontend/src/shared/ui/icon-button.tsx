import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'

type Variant = 'ghost' | 'secondary' | 'primary'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  ghost: 'text-ink hover:bg-hover-tint active:bg-press-tint',
  secondary: 'bg-surface-3 text-ink hover:bg-line light:hover:bg-line-soft',
  primary: 'bg-primary text-white hover:bg-primary-hover',
}

const sizes: Record<Size, string> = {
  sm: 'size-9 rounded-sm',
  md: 'size-11 rounded-md',
  lg: 'size-14 rounded-lg',
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Обязателен: у кнопки без текста это единственное название для скринридера */
  'aria-label': string
  icon: ReactNode
  variant?: Variant
  size?: Size
  /** Внутренняя ссылка: тогда это <Link> с тем же видом */
  to?: string
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  to,
  ...props
}: IconButtonProps) {
  const classes = cn(
    'inline-grid shrink-0 pressable place-items-center disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  )
  if (to)
    return (
      <Link to={to} aria-label={props['aria-label']} className={classes}>
        {icon}
      </Link>
    )
  return (
    <button type={type} className={classes} {...props}>
      {icon}
    </button>
  )
}
