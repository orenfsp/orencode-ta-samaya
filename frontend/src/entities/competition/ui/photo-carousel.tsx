import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconButton, IconChevronLeft, IconChevronRight } from '@/shared/ui'
import type { CompetitionFile } from '../model/types'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Фото соревнования без отдельной обложки: листаются по кругу сами (в карточках ленты)
 * или стрелками (в карточке соревнования). На наведение и фокус — пауза.
 */
export function PhotoCarousel({
  photos,
  title,
  controls = false,
  fallback = null,
  className,
}: {
  photos: CompetitionFile[]
  title: string
  /** Стрелки и счётчик — для большой галереи */
  controls?: boolean
  /** Что показать, если ни одно фото не загрузилось (файл удалён, нет сети) — вместо битой картинки с alt-текстом */
  fallback?: ReactNode
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [broken, setBroken] = useState<string[]>([])
  const shown = photos.filter((photo) => !broken.includes(String(photo.id)))
  const count = shown.length

  useEffect(() => {
    if (count < 2 || paused || reducedMotion()) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), 4000)
    return () => window.clearInterval(timer)
  }, [count, paused])

  if (!count) return fallback
  const current = index % count
  const go = (offset: number) => setIndex((current + offset + count) % count)

  return (
    <div
      className={cn('group relative aspect-video overflow-hidden rounded-lg bg-surface-2', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="галерея"
      aria-label={`Фото: ${title}`}
    >
      {shown.map((photo, position) => (
        <img
          key={photo.id}
          src={photo.url}
          alt={`${title}, фото ${position + 1} из ${count}`}
          loading="lazy"
          onError={() => setBroken((current) => [...current, String(photo.id)])}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-700 ease-emphasized',
            position === current ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden="true">
          {shown.map((photo, position) => (
            <span
              key={photo.id}
              className={cn(
                'h-1.5 rounded-full bg-white transition-[width,opacity] duration-340',
                position === current ? 'w-4 opacity-100' : 'w-1.5 opacity-60',
              )}
            />
          ))}
        </div>
      )}
      {controls && count > 1 && (
        <>
          <IconButton
            aria-label="Предыдущее фото"
            icon={<IconChevronLeft />}
            size="sm"
            onClick={() => go(-1)}
            className="absolute top-1/2 left-3 -translate-y-1/2 bg-canvas/80"
          />
          <IconButton
            aria-label="Следующее фото"
            icon={<IconChevronRight />}
            size="sm"
            onClick={() => go(1)}
            className="absolute top-1/2 right-3 -translate-y-1/2 bg-canvas/80"
          />
          <span className="absolute top-3 right-3 rounded-sm bg-canvas/80 px-2 py-0.5 font-mono text-xs text-ink">
            {current + 1} / {count}
          </span>
        </>
      )}
    </div>
  )
}
