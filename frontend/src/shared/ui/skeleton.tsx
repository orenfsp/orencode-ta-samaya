import { cn } from '@/shared/lib'

/** Заглушка формы будущего контента. Размер задаётся className: h-5 w-40, size-12 rounded-full… */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block h-4 animate-skeleton inset rounded-sm', className)} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex flex-col gap-2.5', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full'} />
      ))}
    </span>
  )
}
