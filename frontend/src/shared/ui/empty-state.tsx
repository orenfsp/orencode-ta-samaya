import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { Button } from './button'
import { IconAlert, IconInbox, IconRefresh } from './icons'

export interface EmptyStateProps {
  title: ReactNode
  /** Почему пусто и что сделать — без этого пустое состояние бесполезно */
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex animate-rise flex-col items-center gap-4 px-6 py-12 text-center', className)}>
      <span className="text-muted">{icon ?? <IconInbox size={26} />}</span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-h3 font-medium text-ink">{title}</h3>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export interface ErrorStateProps {
  title?: ReactNode
  /** Своё объяснение; иначе берём текст из ошибки (ApiError уже переведён на человеческий) */
  description?: ReactNode
  error?: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/** Ошибка загрузки: человеческий текст и «Повторить», без кодов и стектрейсов */
export function ErrorState({
  title = 'Не удалось загрузить',
  description,
  error,
  onRetry,
  retrying,
  className,
}: ErrorStateProps) {
  const message =
    description ?? (error instanceof Error ? error.message : 'Проверьте соединение и попробуйте ещё раз')
  return (
    <div
      role="alert"
      className={cn('flex animate-rise flex-col items-center gap-4 px-6 py-12 text-center', className)}
    >
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger-text">
        <IconAlert size={26} />
      </span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-h3 font-medium text-ink">{title}</h3>
        <p className="text-body text-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" leftIcon={<IconRefresh size={18} />} onClick={onRetry} loading={retrying}>
          Повторить
        </Button>
      )}
    </div>
  )
}
