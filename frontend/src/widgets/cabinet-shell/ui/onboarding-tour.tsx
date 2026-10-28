import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { sessionApi, sessionKeys, type Me, type Role } from '@/entities/session'
import { cn } from '@/shared/lib'
import { Button, IconArrowRight } from '@/shared/ui'
import { TOUR_EVENT, tourSteps } from '../model/tour'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const PAD = 6
const CARD = 352

/** Видимая цель шага: меню кабинета есть дважды (сайдбар и выдвижное), берём ту, что на экране */
function findTarget(target?: string): Box | null {
  if (!target) return null
  for (const node of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`)) {
    const rect = node.getBoundingClientRect()
    const visible = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth
    if (visible)
      return {
        left: rect.left - PAD,
        top: rect.top - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
  }
  return null
}

/**
 * Навигатор новичка: при первом входе в кабинет роли подсвечивает разделы меню по очереди и объясняет каждый.
 * Пройден или пропущен — отметка на бэке, второй раз сам не покажется; повторить — из «Настроек».
 */
export function OnboardingTour({ me, role }: { me: Me; role: Role }) {
  const done = me.roles.find((item) => item.role === role)?.onboarding_done ?? true
  const [open, setOpen] = useState(!done)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const client = useQueryClient()
  const finish = useMutation({
    mutationFn: () => sessionApi.completeOnboarding(role),
    onSettled: () => void client.invalidateQueries({ queryKey: sessionKeys.me }),
  })
  const steps = tourSteps(role)
  const step = steps[Math.min(index, steps.length - 1)]!
  const last = index === steps.length - 1

  useEffect(() => {
    const again = () => {
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(TOUR_EVENT, again)
    return () => window.removeEventListener(TOUR_EVENT, again)
  }, [])

  // Положение цели следим и при прокрутке, и при смене размера окна
  useEffect(() => {
    if (!open) return
    let frame = requestAnimationFrame(() => setBox(findTarget(step.target)))
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setBox(findTarget(step.target)))
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    cardRef.current?.focus()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step.target])

  if (!open) return null

  const close = () => {
    setOpen(false)
    if (!done) finish.mutate()
  }
  const go = (next: number) => setIndex(Math.max(0, Math.min(steps.length - 1, next)))
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
    else if (event.key === 'ArrowRight') go(index + 1)
    else if (event.key === 'ArrowLeft') go(index - 1)
  }

  // Карточка справа от подсвеченного пункта меню; без цели (телефон, приветствие) — по центру
  const cardStyle = box
    ? {
        left: Math.min(box.left + box.width + 16, window.innerWidth - CARD - 16),
        top: Math.max(16, Math.min(box.top - 8, window.innerHeight - 280)),
      }
    : undefined

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation" onKeyDown={onKeyDown}>
      {box ? (
        <div
          aria-hidden="true"
          style={box}
          className="pointer-events-none absolute rounded-lg shadow-[0_0_0_9999px_var(--c-scrim)] ring-2 ring-primary transition-[left,top,width,height] duration-300 ease-emphasized motion-reduce:transition-none"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 animate-pop-in bg-scrim" />
      )}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={cardStyle}
        className={cn(
          'absolute flex w-[min(22rem,calc(100%-2rem))] animate-pop-in flex-col gap-4 overlay p-5 outline-none',
          box
            ? 'transition-[left,top] duration-300 ease-emphasized motion-reduce:transition-none'
            : 'inset-x-4 bottom-4 mx-auto sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-muted tabular-nums">
            {index + 1} из {steps.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded-sm text-sm text-muted transition-colors hover:text-ink focus-visible:field-focus"
          >
            {last ? 'Закрыть' : 'Пропустить'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <h2 id="tour-title" className="text-h3 font-medium text-ink">
            {step.title}
          </h2>
          <p className="text-body text-muted">{step.text}</p>
          {step.link && (
            <Link
              to={step.link.to}
              onClick={close}
              className="inline-flex items-center gap-1.5 self-start link-underline text-body text-ink focus-visible:field-focus"
            >
              {step.link.label}
              <IconArrowRight size={16} />
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex gap-1.5" aria-hidden="true">
            {steps.map((_, position) => (
              <span
                key={position}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] duration-300',
                  position === index ? 'w-5 bg-primary' : 'w-1.5 bg-line',
                )}
              />
            ))}
          </span>
          <span className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => go(index - 1)}>
                Назад
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? close() : go(index + 1))}>
              {last ? 'Готово' : 'Дальше'}
            </Button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
