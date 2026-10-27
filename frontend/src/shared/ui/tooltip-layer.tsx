import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Короче — плашка мельтешит, когда курсор проходит по панели */
const SHOW_DELAY_MS = 450
const GAP = 8
const EDGE = 8
/** aria-label — только у интерактивных: у регионов и диалогов подсказка была бы шумом */
const TIP_SELECTOR = '[data-tooltip],button[aria-label],a[aria-label],[role="button"][aria-label]'

interface Tip {
  text: string
  target: HTMLElement
  container: HTMLElement
}

/**
 * Одна подсказка на документ: один слушатель находит ближайший элемент с подсказкой,
 * поэтому кнопкам не нужны обёртки. Текст — data-tooltip, иначе aria-label кнопки без видимого текста:
 * имя для скринридера и подсказка совпадают по построению. На таче не показывается.
 *
 * <IconButton aria-label="Скачать протокол" … /> — подсказка появится сама.
 * data-no-tooltip — отказаться, если имя и так видно крупно.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: HTMLElement | null = null

    const hide = () => {
      clearTimeout(timer)
      current = null
      setTip(null)
    }

    // Дешёвый textContent сначала, дорогой innerText (пересчёт раскладки) — только если текст есть
    const hasVisibleText = (el: HTMLElement) =>
      Boolean(el.textContent?.trim()) && Boolean(el.innerText.trim())

    const onOver = (event: Event) => {
      const el = (event.target as Element | null)?.closest?.(TIP_SELECTOR) as HTMLElement | null
      if (!el || el.hasAttribute('data-no-tooltip') || el === current) return
      const text = el.dataset.tooltip || (hasVisibleText(el) ? null : el.getAttribute('aria-label'))
      if (!text) return
      clearTimeout(timer)
      current = el
      timer = setTimeout(
        () => setTip({ text, target: el, container: (el.closest('dialog') as HTMLElement) ?? document.body }),
        SHOW_DELAY_MS,
      )
    }

    const onOut = (event: Event) => {
      const related = (event as PointerEvent).relatedTarget as Node | null
      // Уход на вложенную иконку того же элемента подсказку не прячет
      if (current && related && current.contains(related)) return
      hide()
    }

    document.addEventListener('pointerover', onOver, true)
    document.addEventListener('pointerout', onOut, true)
    document.addEventListener('focusin', onOver, true)
    document.addEventListener('focusout', hide, true)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', hide, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('pointerout', onOut, true)
      document.removeEventListener('focusin', onOver, true)
      document.removeEventListener('focusout', hide, true)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', hide, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Позиция по реальному размеру плашки: снизу, а если не влезает — сверху; по горизонтали — в пределах экрана
  useLayoutEffect(() => {
    const el = tipRef.current
    if (!tip || !el) return
    const rect = tip.target.getBoundingClientRect()
    const below = rect.bottom + GAP + el.offsetHeight <= window.innerHeight - EDGE
    const top = below ? rect.bottom + GAP : rect.top - GAP - el.offsetHeight
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - el.offsetWidth / 2, EDGE),
      window.innerWidth - EDGE - el.offsetWidth,
    )
    el.style.top = `${top}px`
    el.style.left = `${left}px`
    el.dataset.side = below ? 'bottom' : 'top'
    const frame = requestAnimationFrame(() => (el.dataset.open = 'true'))
    return () => cancelAnimationFrame(frame)
  }, [tip])

  if (!tip) return null

  return createPortal(
    <div
      ref={tipRef}
      // Для скринридера плашка лишняя: имя элементу уже дал aria-label
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-60 max-w-72 truncate rounded-sm bg-paper px-2.5 py-1.5 text-sm text-on-paper opacity-0 transition-[opacity,translate] duration-150 ease-out select-none data-[open=true]:translate-y-0 data-[open=true]:opacity-100 data-[side=bottom]:-translate-y-1 data-[side=top]:translate-y-1"
    >
      {tip.text}
    </div>,
    tip.container,
  )
}
