import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib'
import { usePortalTarget } from './portal-context'

const GAP = 6
const EDGE = 8

export interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  /** Выравнивание по левому или правому краю якоря */
  align?: 'start' | 'end'
  /** Ширина как у якоря — для списков комбобокса */
  matchWidth?: boolean
  id?: string
  role?: string
  className?: string
  children: ReactNode
}

/**
 * Всплывающая панель у якоря: fixed-позиция, переворот вверх при нехватке места снизу,
 * закрытие кликом снаружи и Escape. Одна реализация на меню, комбобокс и всё похожее.
 *
 * Панель всегда в DOM и прячется visibility: так переход работает в обе стороны.
 * data-open и координаты пишутся прямо в узел — это синхронизация с раскладкой, а не состояние React.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = 'start',
  matchWidth = false,
  id,
  role,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const target = usePortalTarget()
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useLayoutEffect(() => {
    const panel = panelRef.current
    const anchor = anchorRef.current
    if (!panel || !anchor) return
    if (!open) {
      panel.dataset.open = 'false'
      return
    }

    const place = () => {
      const rect = anchor.getBoundingClientRect()
      if (matchWidth) panel.style.width = `${rect.width}px`
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - EDGE
      const below = fitsBelow || rect.top < height + GAP + EDGE
      const top = below ? rect.bottom + GAP : rect.top - GAP - height
      const preferred = align === 'end' ? rect.right - width : rect.left
      const left = Math.min(Math.max(preferred, EDGE), window.innerWidth - EDGE - width)
      panel.style.top = `${top}px`
      panel.style.left = `${left}px`
      panel.dataset.side = below ? 'bottom' : 'top'
    }

    place()
    // Панель уже в DOM в закрытом виде, поэтому переход сработает и без отложенного кадра,
    // а фокус в неё можно ставить сразу после открытия
    panel.dataset.open = 'true'
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align, matchWidth, anchorRef])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (panelRef.current?.contains(node) || anchorRef.current?.contains(node)) return
      onCloseRef.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Escape закрывает панель, а не модалку под ней
      event.stopPropagation()
      event.preventDefault()
      onCloseRef.current()
      anchorRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, anchorRef])

  if (!target) return null

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-hidden={!open || undefined}
      inert={!open}
      className={cn(
        'fixed top-0 left-0 z-50 min-w-44 overlay rounded-lg p-1',
        'invisible scale-[0.98] opacity-0 transition-[opacity,scale,translate,visibility] duration-180 ease-emphasized',
        'data-[side=bottom]:origin-top data-[side=bottom]:-translate-y-1 data-[side=top]:origin-bottom data-[side=top]:translate-y-1',
        'data-[open=true]:visible data-[open=true]:translate-y-0 data-[open=true]:scale-100 data-[open=true]:opacity-100',
        className,
      )}
    >
      {children}
    </div>,
    target,
  )
}
