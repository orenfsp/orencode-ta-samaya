import { BrandLogo, IconArrowUp } from '@/shared/ui'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-line-soft">
      <div className="container-page flex flex-col gap-10 py-10 sm:py-14">
        <div className="flex items-start justify-between gap-6">
          <BrandLogo className="h-8 w-auto sm:h-9" />
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex items-center gap-3 text-sm text-ink"
          >
            <span className="hidden sm:inline">Наверх</span>
            <span className="grid size-11 pressable place-items-center rounded-md bg-surface-3 group-hover:bg-line">
              <IconArrowUp
                size={18}
                className="transition-[translate] duration-220 ease-spring group-hover:-translate-y-0.5"
              />
            </span>
          </button>
        </div>
        <p className="text-sm text-muted">
          Региональное отделение Федерации спортивного программирования Оренбургской области ©{year}
        </p>
      </div>
    </footer>
  )
}
