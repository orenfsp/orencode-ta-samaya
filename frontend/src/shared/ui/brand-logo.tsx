import { cn } from '@/shared/lib'

/**
 * Официальный логотип ФСП под тему: на тёмном фоне — белый, на светлом — цветной.
 * onPaper — для светлой плашки шапки: там всегда цветной. Логотип не перерисовывается кодом — только файлы брендбука.
 */
export function BrandLogo({ onPaper = false, className }: { onPaper?: boolean; className?: string }) {
  if (onPaper) return <img src="/brand/fsp-logo.svg" alt="ФСП" className={cn('w-auto', className)} />
  return (
    <>
      <img src="/brand/fsp-logo-white.svg" alt="ФСП" className={cn('w-auto light:hidden', className)} />
      <img src="/brand/fsp-logo.svg" alt="ФСП" className={cn('hidden w-auto light:block', className)} />
    </>
  )
}

/** Знак-звезда ФСП: в тёмной теме с белым элементом, в светлой — с серым */
export function BrandMark({ className }: { className?: string }) {
  return (
    <>
      <img src="/brand/fsp-mark.svg" alt="" aria-hidden="true" className={cn('light:hidden', className)} />
      <img
        src="/brand/fsp-mark-light.svg"
        alt=""
        aria-hidden="true"
        className={cn('hidden light:block', className)}
      />
    </>
  )
}

/**
 * Официальная иконка дисциплины (public/brand/disciplines) под тему: в светлой — вариант *-light,
 * где светлые линии брендбука заменены цветом текста, синий не меняется.
 */
export function DisciplineIcon({ name, className }: { name: string; className?: string }) {
  return (
    <>
      <img
        src={`/brand/disciplines/${name}.svg`}
        alt=""
        aria-hidden="true"
        className={cn('light:hidden', className)}
      />
      <img
        src={`/brand/disciplines/${name}-light.svg`}
        alt=""
        aria-hidden="true"
        className={cn('hidden light:block', className)}
      />
    </>
  )
}
