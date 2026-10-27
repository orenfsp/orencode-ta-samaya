import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconAlert, IconCheckCircle, IconInfo } from './icons'

const tones = {
  danger: { box: 'bg-danger-soft', icon: <IconAlert size={18} className="text-danger-text" /> },
  info: { box: 'bg-surface-3', icon: <IconInfo size={18} className="text-muted" /> },
  success: { box: 'bg-primary-soft', icon: <IconCheckCircle size={18} className="text-ink" /> },
}

/** Сообщение уровня формы: «неверная почта или пароль», «ссылка устарела». Ошибки полей — у самих полей */
export function FormAlert({
  tone = 'danger',
  children,
  className,
}: {
  tone?: keyof typeof tones
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex animate-pop-in items-start gap-3 rounded-md px-4 py-3 text-body text-ink',
        tones[tone].box,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{tones[tone].icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
