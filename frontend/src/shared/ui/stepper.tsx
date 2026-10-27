import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconCheck } from './icons'

export interface Step {
  title: ReactNode
  description?: ReactNode
  /** Действия шага: кнопки скачивания, переходы */
  actions?: ReactNode
}

/** Шаги процесса с крупной моно-нумерацией [1]…[N] (кит §5.13). current — индекс активного шага */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: Step[]
  current: number
  className?: string
}) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const last = index === steps.length - 1
        return (
          <li key={index} aria-current={active ? 'step' : undefined} className="relative flex gap-4 sm:gap-5">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-md border font-mono text-body font-bold transition-[background-color,border-color,color,scale] duration-340 ease-spring',
                  done && 'border-primary bg-primary text-white',
                  active && 'scale-105 border-primary bg-primary-soft text-ink',
                  !done && !active && 'border-line-soft bg-surface-2 text-muted',
                )}
              >
                {done ? <IconCheck size={18} strokeWidth={2.25} /> : `[${index + 1}]`}
              </span>
              {!last && (
                <span className="relative my-1.5 w-0.5 flex-1 overflow-hidden rounded-full bg-line-soft">
                  <span
                    className={cn(
                      'absolute inset-0 origin-top bg-primary transition-[scale] duration-340 ease-emphasized',
                      done ? 'scale-y-100' : 'scale-y-0',
                    )}
                  />
                </span>
              )}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5 pt-2.5', !last && 'pb-8')}>
              <p
                className={cn(
                  'text-body font-medium transition-colors duration-220',
                  active || done ? 'text-ink' : 'text-muted',
                )}
              >
                {step.title}
              </p>
              {step.description && <p className="text-sm text-muted">{step.description}</p>}
              {step.actions && <div className="mt-2 flex flex-wrap gap-2">{step.actions}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
