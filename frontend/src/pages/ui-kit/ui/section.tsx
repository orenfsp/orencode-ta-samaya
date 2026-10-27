import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-h2 font-medium text-ink">{title}</h2>
        {description && <p className="max-w-2xl text-body text-muted">{description}</p>}
      </div>
      <div className={cn('panel p-5 sm:p-8', className)}>{children}</div>
    </section>
  )
}

export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {label && <p className="text-sm font-medium text-muted">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}
