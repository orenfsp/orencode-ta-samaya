import type { ReactNode } from 'react'
import { BrandMark } from '@/shared/ui'

export interface AuthShowcaseProps {
  title: ReactNode
  caption?: ReactNode
}

/**
 * Правая половина страниц входа: сетка-подложка как в карточках fsp-russia.ru, слоган страницы
 * и фирменный знак ФСП крупно, обрезанный краем. Знак — официальный файл из брендбука, не перерисован.
 */
export function AuthShowcase({ title, caption }: AuthShowcaseProps) {
  return (
    <aside
      aria-hidden="true"
      className="grid-texture h-full overflow-hidden rounded-2xl border border-line-soft"
    >
      <BrandMark className="absolute -right-[26%] -bottom-[20%] w-[100%] max-w-none animate-mark" />
      <div className="relative flex max-w-lg flex-col gap-6 p-10 xl:p-12">
        <p className="font-mono text-sm text-primary-text">Региональное отделение · Оренбургская область</p>
        {/* key по тексту: при переходе между страницами слоган сменяется плавно, а не прыгает */}
        <div key={String(title)} className="flex animate-rise flex-col gap-4">
          <p className="text-h1 font-medium text-balance text-ink">{title}</p>
          {caption && <p className="max-w-md text-lead text-muted">{caption}</p>}
        </div>
      </div>
    </aside>
  )
}
