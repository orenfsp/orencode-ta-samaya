import { cn } from '@/shared/lib'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'paper' | 'ghost' | 'danger' | 'text'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<Exclude<ButtonVariant, 'text'>, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-press',
  secondary: 'bg-surface-3 text-ink hover:bg-line light:hover:bg-line-soft',
  outline: 'border border-line text-ink hover:border-ink',
  // Светлая кнопка на тёмном, как «Скачать брендбук» на сайте ФСП
  // В светлой теме бумага белая — держим контур рамкой
  paper: 'bg-paper text-on-paper hover:bg-paper-2 light:border light:border-line light:hover:border-ink',
  ghost: 'text-ink hover:bg-hover-tint active:bg-press-tint',
  // Белый на красном читается только крупным жирным — поэтому bold и притемнённая заливка
  danger: 'bg-danger-strong font-bold text-white hover:bg-danger',
}

// min-h, а не h: длинная подпись переносится, а не обрезается
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 gap-1.5 rounded-sm px-3.5 py-1.5 text-sm',
  md: 'min-h-11 gap-2 rounded-md px-5 py-2 text-body',
  lg: 'min-h-14 gap-2.5 rounded-md px-7 py-3 text-lead',
}

const textSizes: Record<ButtonSize, string> = { sm: 'text-sm', md: 'text-body', lg: 'text-lead' }

interface ButtonClassOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}

/** Классы кнопки — для элементов, которые выглядят как кнопка, но ей не являются (label у файла и т.п.) */
export function buttonClass({ variant = 'primary', size = 'md', fullWidth, className }: ButtonClassOptions) {
  // Кнопка-ссылка внутри строки («Забыли пароль?»): без подложки и полей
  if (variant === 'text') {
    return cn(
      'group/button relative inline-flex items-center gap-1.5 font-medium text-ink',
      'underline decoration-line underline-offset-4 transition-[text-decoration-color,color] duration-150',
      'hover:decoration-ink disabled:cursor-not-allowed disabled:text-muted',
      textSizes[size],
      className,
    )
  }

  return cn(
    'group/button relative inline-flex shrink-0 pressable items-center justify-center text-center font-medium select-none',
    // Под курсором кнопка чуть тянется к человеку — только у мыши (у пальца ховер залипает) и не во всю ширину
    !fullWidth && '[@media(hover:hover)]:[&:hover:not(:disabled,:active)]:scale-[1.02]',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-3 disabled:text-muted',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  )
}
