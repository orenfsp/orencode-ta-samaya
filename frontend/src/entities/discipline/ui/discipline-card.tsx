import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { cn, disciplineIconName } from '@/shared/lib'
import { DisciplineIcon, IconArrowRight } from '@/shared/ui'

/**
 * Карточка дисциплины, как на главной fsp-russia.ru: тонкая рамка, сетка-подложка,
 * линия-связь в углу и официальная иконка. Название и описание — из справочника, ведёт в каталог.
 */
export function DisciplineCard({
  name,
  description,
  to,
  className,
  style,
}: {
  name: string
  description: string | null
  to: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <Link
      to={to}
      style={style}
      className={cn(
        'group grid-texture flex flex-col gap-6 overflow-hidden rounded-lg border border-line-soft p-6 sm:p-8',
        'transition-[border-color,translate] duration-340 ease-emphasized hover:-translate-y-1 hover:border-primary focus-visible:field-focus',
        className,
      )}
    >
      <img
        src="/brand/card-line.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-6 right-6 w-1/2 max-w-52 opacity-70 transition-opacity duration-340 group-hover:opacity-100"
      />
      <DisciplineIcon
        name={disciplineIconName(name)}
        className="size-12 transition-[translate] duration-340 ease-spring group-hover:-translate-y-1"
      />
      <div className="mt-auto flex flex-col gap-3">
        <h3 className="flex items-start gap-2 text-h3 font-medium text-balance">
          <span className="min-w-0 flex-1">{name}</span>
          <IconArrowRight
            size={20}
            className="mt-1 shrink-0 text-muted transition-[translate,color] duration-220 group-hover:translate-x-1 group-hover:text-ink"
          />
        </h3>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
    </Link>
  )
}
