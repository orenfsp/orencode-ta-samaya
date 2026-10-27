import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib'
import { DisciplineIcon } from '@/shared/ui'
import type { Discipline } from '../model/disciplines'

/**
 * Карточка дисциплины, как на главной fsp-russia.ru: тонкая рамка, сетка-подложка,
 * линия-связь в углу и официальная иконка дисциплины.
 */
export function DisciplineCard({
  discipline,
  className,
  style,
}: {
  discipline: Discipline
  className?: string
  style?: CSSProperties
}) {
  return (
    <article
      style={style}
      className={cn(
        'group grid-texture flex flex-col gap-6 overflow-hidden rounded-lg border border-line-soft p-7 sm:p-9',
        'transition-[border-color,translate] duration-340 ease-emphasized hover:-translate-y-1 hover:border-line',
        className,
      )}
    >
      <img
        src="/brand/card-line.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-7 right-7 w-1/2 max-w-52 opacity-80 transition-opacity duration-340 group-hover:opacity-100"
      />
      <DisciplineIcon
        name={discipline.id}
        className="size-13 transition-[translate] duration-340 ease-spring group-hover:-translate-y-1"
      />
      <div className="flex flex-col gap-4">
        <h3 className="text-h3 font-medium text-balance lg:text-h2">{discipline.name}</h3>
        <p className="text-body text-muted">{discipline.description}</p>
      </div>
    </article>
  )
}
