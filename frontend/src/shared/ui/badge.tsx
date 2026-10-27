import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib'

export type BadgeTone = 'neutral' | 'primary' | 'solid' | 'outline' | 'dark' | 'paper' | 'danger'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-ink',
  primary: 'bg-primary-soft text-ink',
  solid: 'bg-primary text-white',
  // Онлайн — синий контур, Оффлайн — нейтральный (кит §5.7). Текст светлый: синий текстом на тёмном нельзя
  outline: 'border border-primary text-ink',
  dark: 'border border-line text-ink',
  // Плашка даты, как в таймлайне на сайте ФСП
  paper: 'bg-paper text-primary',
  danger: 'bg-danger-soft text-ink',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  /** Цветная точка слева: дисциплина, статус */
  dot?: boolean
  icon?: ReactNode
}

export function Badge({ tone = 'neutral', dot, icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  )
}
