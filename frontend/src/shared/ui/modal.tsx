import { useEffect, useId, useRef, useState, type FormEventHandler, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { Button } from './button'
import { IconButton } from './icon-button'
import { IconClose } from './icons'
import { PortalContext } from './portal-context'

/** Выход короче входа: закрытие не должно задерживать человека */
const EXIT_MS = 180

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** sm — подтверждение, md — короткая форма, lg — форма сущности, xl — списки и таблицы */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Окно — форма: Enter в поле отправляет, кнопка type="submit" в footer работает */
  onSubmit?: FormEventHandler<HTMLFormElement>
}

const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }

/**
 * Единственное модальное окно в проекте: по центру на десктопе, шторкой снизу на телефоне.
 * Шапка и подвал на месте, прокручивается только середина — длинная форма влезает в любой экран.
 *
 * Нативный <dialog>: фокус-ловушка, Escape и инертный фон — от браузера.
 * Вход: фон проявляется, окно поднимается на 12px и чуть растёт (280 мс). Выход быстрее и без пружины (180 мс).
 * data-open пишем прямо в DOM-узел — это синхронизация с браузерным диалогом, не состояние React.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  onSubmit,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Узел диалога — в состоянии: вложенные поповеры рендерятся в него, а ref во время рендера читать нельзя
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
    if (!dialog.open) return
    dialog.dataset.open = 'false'
    const timer = setTimeout(() => {
      dialog.close()
      document.documentElement.style.overflow = ''
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => () => void (document.documentElement.style.overflow = ''), [])

  // Без onSubmit тело — обычный блок: form внутри формы не нужна
  const Panel = (onSubmit ? 'form' : 'section') as 'form'
  const roomy = size === 'lg' || size === 'xl'

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
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        className={cn(
          'flex h-full items-end justify-center bg-scrim sm:items-center sm:p-6',
          'opacity-0 transition-opacity duration-180 ease-in',
          'group-data-[open=true]/modal:opacity-100 group-data-[open=true]/modal:duration-280 group-data-[open=true]/modal:ease-standard',
        )}
      >
        <Panel
          onSubmit={onSubmit}
          noValidate={onSubmit ? true : undefined}
          className={cn(
            'flex max-h-[92dvh] w-full flex-col overlay rounded-b-none sm:max-h-[min(88dvh,60rem)] sm:rounded-b-xl',
            // Телефон: шторка выезжает снизу. Десктоп: поднимается на 12px и дорастает до 100%
            'translate-y-full sm:translate-y-3 sm:scale-[0.97] sm:opacity-0',
            'transition-[translate,scale,opacity] duration-180 ease-in',
            'group-data-[open=true]/modal:translate-y-0 group-data-[open=true]/modal:scale-100 group-data-[open=true]/modal:opacity-100',
            'group-data-[open=true]/modal:duration-280 group-data-[open=true]/modal:ease-emphasized',
            sizes[size],
          )}
        >
          {/* Ручка шторки на телефоне — подсказка, что окно снизу и его можно закрыть */}
          <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
          <header
            className={cn(
              'flex items-start gap-4 px-5 pt-3 pb-4 sm:px-6 sm:pt-6',
              roomy && 'border-b border-line-soft',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 id={titleId} className="text-h3 font-medium text-balance break-words text-ink">
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
              className="-mt-1 -mr-2"
            />
          </header>
          {children && (
            <PortalContext.Provider value={dialogEl}>
              <div
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6',
                  roomy ? 'py-6' : 'pb-1',
                )}
              >
                {children}
              </div>
            </PortalContext.Provider>
          )}
          <footer
            className={cn(
              'flex flex-col-reverse gap-2 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-6',
              roomy && 'border-t border-line-soft sm:pt-4 sm:pb-4',
            )}
          >
            {footer ?? (
              <Button variant="ghost" onClick={onClose}>
                Закрыть
              </Button>
            )}
          </footer>
        </Panel>
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
