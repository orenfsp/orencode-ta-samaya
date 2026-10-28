import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconCalendar, IconShieldCheck, IconShieldX, IconTrophy } from './icons'

/*
 * Метки — четыре вида, у каждого своя форма, чтобы их не путали:
 *   StatusTag    — где объект в жизненном цикле: точка + текст, без плашки;
 *   MetaTag      — свойство (формат, возраст, источник): тонкая рамка;
 *   KindTag      — что это за сущность (соревнование / событие): иконка + моно-подпись;
 *   VerifiedMark — верификация ФСП: щит у названия, текст — в подсказке.
 */

export type StatusTone = 'draft' | 'active' | 'live' | 'done' | 'cancelled'

const dot: Record<StatusTone, string> = {
  draft: 'bg-line',
  active: 'bg-primary',
  live: 'bg-live',
  done: 'bg-muted',
  cancelled: 'bg-live',
}

/** Статус: «live» — красная пульсирующая точка (идёт сейчас), «cancelled» — красная точка и зачёркнутый смысл в тексте */
export function StatusTag({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-sm whitespace-nowrap',
        tone === 'done' || tone === 'draft'
          ? 'text-muted'
          : tone === 'cancelled'
            ? 'text-live-text'
            : 'text-ink',
        className,
      )}
    >
      <span aria-hidden="true" className="relative grid size-2 place-items-center">
        {tone === 'live' && <span className="absolute size-2 animate-ping rounded-full bg-live opacity-60" />}
        <span className={cn('size-2 rounded-full', dot[tone])} />
      </span>
      {children}
    </span>
  )
}

/** Свойство объекта: формат, возраст, источник. Нейтральная тонкая рамка; accent — синяя рамка (онлайн) */
export function MetaTag({
  children,
  accent = false,
  className,
}: {
  children: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-sm border px-2 text-xs whitespace-nowrap',
        accent ? 'border-primary text-primary-text' : 'border-line text-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Вид сущности: соревнование — синяя иконка, событие ФСП — красная, чтобы различались с первого взгляда */
export function KindTag({ kind, className }: { kind: 'contest' | 'event'; className?: string }) {
  const Icon = kind === 'contest' ? IconTrophy : IconCalendar
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-xs text-muted', className)}>
      <Icon size={14} className={kind === 'contest' ? 'text-primary-text' : 'text-live-text'} />
      {kind === 'contest' ? 'Соревнование' : 'Событие'}
    </span>
  )
}

export type VerificationState = 'verified' | 'pending' | 'rejected'

const verification: Record<VerificationState, { tip: string; className: string }> = {
  verified: {
    tip: 'Верифицировано ФСП: баллы идут в рейтинг и зафиксированы',
    className: 'text-primary-text',
  },
  pending: { tip: 'Ждёт верификации ФСП', className: 'text-muted' },
  rejected: { tip: 'В верификации отказано', className: 'text-live-text' },
}

/** Щит у названия вместо надписи. Подсказка — через TooltipLayer (data-tooltip), имя — для скринридера */
export function VerifiedMark({
  state = 'verified',
  reason,
  className,
}: {
  state?: VerificationState
  reason?: string | null
  className?: string
}) {
  const { tip, className: tone } = verification[state]
  const text = reason ? `${tip}: ${reason}` : tip
  return (
    <span
      role="img"
      aria-label={text}
      data-tooltip={text}
      tabIndex={0}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-sm outline-none focus-visible:field-focus',
        tone,
        className,
      )}
    >
      {state === 'rejected' ? <IconShieldX size={20} /> : <IconShieldCheck size={20} />}
    </span>
  )
}
