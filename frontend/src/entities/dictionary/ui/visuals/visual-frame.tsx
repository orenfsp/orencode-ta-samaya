import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

/** Общая рамка наглядного блока справочника: сетка-подложка, тонкая граница, подпись снизу */
export function VisualFrame({
  label,
  note,
  children,
  className,
}: {
  label: string
  note?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'grid-texture flex flex-col gap-5 rounded-lg border border-line-soft p-5 sm:p-6',
        className,
      )}
    >
      {children}
      {note && <div className="text-sm text-muted">{note}</div>}
    </section>
  )
}

/** Кнопка-элемент визуализации: открывает карточку записи. Архивные не показываем */
export const visualItemClass =
  'pressable cursor-pointer outline-none transition-[border-color,background-color,color,translate] duration-220 ease-emphasized focus-visible:field-focus'
