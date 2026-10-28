import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconButton } from './icon-button'
import { IconClose } from './icons'
import { PortalContext } from './portal-context'

const EXIT_MS = 200

/**
 * Панель справа — только для центра уведомлений: лента рядом с тем, что человек делает, без ухода со страницы.
 * Формы в ней не живут: формы — в Modal. На телефоне панель на всю ширину.
 * Нативный <dialog>, как у Modal: фокус-ловушка, Escape, инертный фон. data-open пишем в DOM-узел.
 */
export function Sheet({
  open,
  onClose,
  title,
  actions,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Справа от заголовка: «Прочитать все» */
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
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
    if (!dialog.open) return
    dialog.dataset.open = 'false'
    const timer = setTimeout(() => {
      dialog.close()
      document.documentElement.style.overflow = ''
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => () => void (document.documentElement.style.overflow = ''), [])

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
      className="group/sheet m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
    >
      <div
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        className={cn(
          'flex h-full justify-end bg-scrim sm:p-2',
          'opacity-0 transition-opacity duration-200 ease-in',
          'group-data-[open=true]/sheet:opacity-100 group-data-[open=true]/sheet:duration-280',
        )}
      >
        <section
          className={cn(
            'flex h-full w-full flex-col overlay rounded-none sm:w-[26rem] sm:rounded-xl',
            'translate-x-full transition-[translate] duration-200 ease-in',
            'group-data-[open=true]/sheet:translate-x-0 group-data-[open=true]/sheet:duration-320 group-data-[open=true]/sheet:ease-emphasized',
          )}
        >
          <header className="flex items-center gap-3 border-b border-line-soft px-5 py-4">
            <h2 id={titleId} className="mr-auto text-h3 font-medium text-ink">
              {title}
            </h2>
            {actions}
            <IconButton
              aria-label="Закрыть"
              icon={<IconClose />}
              size="sm"
              onClick={onClose}
              className="-mr-2"
            />
          </header>
          <PortalContext.Provider value={dialogEl}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </PortalContext.Provider>
          {footer && <footer className="border-t border-line-soft px-5 py-3">{footer}</footer>}
        </section>
      </div>
    </dialog>
  )
}
