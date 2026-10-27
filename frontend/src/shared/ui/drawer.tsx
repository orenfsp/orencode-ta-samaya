import { useEffect, useId, useRef, useState, type FormEventHandler, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconButton } from './icon-button'
import { IconClose } from './icons'
import { PortalContext } from './portal-context'

const EXIT_MS = 340

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Если задан, панель — форма: Enter в поле отправляет, кнопка type="submit" в footer работает */
  onSubmit?: FormEventHandler<HTMLFormElement>
}

/**
 * Боковая панель для карточек и форм: справа на десктопе, шторкой снизу на телефоне.
 * Нативный <dialog>, как у Modal: фокус, Escape и инертный фон — от браузера.
 */
export function Drawer({ open, onClose, title, description, children, footer, onSubmit }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [dialogEl, setDialogEl] = useState<HTMLDialogElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
      const frame = requestAnimationFrame(() => (dialog.dataset.open = 'true'))
      return () => cancelAnimationFrame(frame)
    }
    dialog.dataset.open = 'false'
    const timer = setTimeout(() => {
      dialog.close()
      document.documentElement.style.overflow = ''
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => () => void (document.documentElement.style.overflow = ''), [])

  // Без onSubmit тело — обычный div, form внутри формы не нужна
  const Body = (onSubmit ? 'form' : 'div') as 'form'

  return (
    <dialog
      ref={(node) => {
        ref.current = node
        setDialogEl(node)
      }}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="group/drawer m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
    >
      <div
        onClick={(event) => event.target === event.currentTarget && onClose()}
        className="flex h-full items-end justify-end bg-scrim opacity-0 transition-opacity duration-340 ease-standard group-data-[open=true]/drawer:opacity-100 sm:items-stretch sm:p-3"
      >
        <Body
          onSubmit={onSubmit}
          noValidate={onSubmit ? true : undefined}
          className={cn(
            'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line-soft bg-surface shadow-layer',
            'sm:max-h-none sm:w-[30rem] sm:rounded-2xl',
            'translate-y-full transition-[translate] duration-340 ease-emphasized sm:translate-x-[calc(100%+1rem)] sm:translate-y-0',
            'group-data-[open=true]/drawer:translate-x-0 group-data-[open=true]/drawer:translate-y-0',
          )}
        >
          <header className="flex items-start gap-4 border-b border-line-soft px-6 py-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id={titleId} className="text-h3 font-medium text-ink">
                {title}
              </h2>
              {description && <p className="text-sm text-muted">{description}</p>}
            </div>
            <IconButton
              aria-label="Закрыть"
              icon={<IconClose />}
              size="sm"
              onClick={onClose}
              className="-mr-2"
            />
          </header>
          <PortalContext.Provider value={dialogEl}>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </PortalContext.Provider>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-line-soft px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </Body>
      </div>
    </dialog>
  )
}
