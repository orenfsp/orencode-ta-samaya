import { useSyncExternalStore, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconAlert, IconCheckCircle, IconClose, IconInfo } from './icons'
import { dismissToast, getToasts, subscribeToasts, type ToastTone } from './toast-store'

const icons: Record<ToastTone, ReactNode> = {
  info: <IconInfo className="text-muted" />,
  success: <IconCheckCircle className="text-ink" />,
  danger: <IconAlert className="text-danger-text" />,
}

export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
    >
      {items.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'danger' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 overlay rounded-lg py-3.5 pr-2 pl-4',
            'transition-[opacity,translate,scale] duration-200 ease-in',
            toast.leaving && 'translate-y-2 scale-96 opacity-0',
          )}
        >
          <span className="mt-0.5 shrink-0">{icons[toast.tone]}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
            <p className="text-body font-medium text-ink">{toast.title}</p>
            {toast.description && <p className="text-sm text-muted">{toast.description}</p>}
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  dismissToast(toast.id)
                }}
                className="mt-1.5 self-start text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => dismissToast(toast.id)}
            className="grid size-8 shrink-0 pressable place-items-center rounded-sm text-muted hover:bg-hover-tint hover:text-ink"
          >
            <IconClose size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
