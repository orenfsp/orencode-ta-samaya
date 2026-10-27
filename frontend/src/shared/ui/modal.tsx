import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { Button } from './button'
import { IconButton } from './icon-button'
import { IconClose } from './icons'
import { PortalContext } from './portal-context'

const EXIT_MS = 220

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

/**
 * Нативный <dialog>: фокус-ловушка, Escape и инертный фон — от браузера.
 * Анимацию входа/выхода ведём сами: showModal → кадр → data-open, на закрытие — ждём выход и только потом close().
 * data-open ставим прямо в DOM: это синхронизация с внешней системой, лишний рендер не нужен.
 * На телефоне окно выезжает снизу шторкой.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Элемент диалога — в состоянии: вложенные поповеры рендерятся в него, а ref во время рендера читать нельзя
  const [dialogEl, setDialogEl] = useState<HTMLDialogElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

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

  return (
    <dialog
      ref={(node) => {
        ref.current = node
        setDialogEl(node)
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="group/modal m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
    >
      <div
        onClick={(event) => event.target === event.currentTarget && onClose()}
        className="flex h-full items-end justify-center bg-scrim opacity-0 transition-opacity duration-220 ease-standard group-data-[open=true]/modal:opacity-100 sm:items-center sm:p-6"
      >
        <section
          className={cn(
            'flex max-h-[92dvh] w-full flex-col overlay rounded-b-none sm:max-h-[85dvh] sm:rounded-b-xl',
            'translate-y-8 transition-[translate,scale,opacity] duration-340 ease-emphasized sm:translate-y-3 sm:scale-96',
            'group-data-[open=true]/modal:translate-y-0 group-data-[open=true]/modal:scale-100',
            sizes[size],
          )}
        >
          <header className="flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 id={titleId} className="text-h3 font-medium text-ink">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-body text-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              aria-label="Закрыть"
              icon={<IconClose />}
              size="sm"
              onClick={onClose}
              className="-mt-1 -mr-1"
            />
          </header>
          {children && (
            <PortalContext.Provider value={dialogEl}>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:px-6">{children}</div>
            </PortalContext.Provider>
          )}
          <footer className="flex flex-col-reverse gap-2 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
            {footer ?? (
              <Button variant="ghost" onClick={onClose}>
                Закрыть
              </Button>
            )}
          </footer>
        </section>
      </div>
    </dialog>
  )
}

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
}

/** Подтверждение необратимого действия. Пока onConfirm выполняется — кнопка в загрузке, повторно не нажать */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  tone = 'primary',
}: ConfirmModalProps) {
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    setPending(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
