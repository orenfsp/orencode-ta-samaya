import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib'
import { IconButton } from './icon-button'
import { IconChevronLeft, IconChevronRight, IconClose } from './icons'

export interface Photo {
  id: string
  url: string
  alt?: string
}

/**
 * Фото выступления плиткой: 1 — во всю ширину, 2 — пополам, 3+ — сетка, лишние скрыты за «+N».
 * Клик открывает просмотр на весь экран со стрелками (клавиши ← → и Escape тоже работают).
 */
export function PhotoGrid({
  photos,
  max = 4,
  className,
}: {
  photos: Photo[]
  max?: number
  className?: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  if (!photos.length) return null
  const shown = photos.slice(0, max)
  const hidden = photos.length - shown.length

  return (
    <>
      <ul
        className={cn(
          'grid gap-1.5 overflow-hidden rounded-lg',
          shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          shown.length >= 3 && 'sm:grid-cols-[2fr_1fr] sm:grid-rows-2',
          className,
        )}
      >
        {shown.map((photo, index) => (
          <li
            key={photo.id}
            className={cn(
              'relative',
              shown.length >= 3 && index === 0 && 'sm:row-span-2',
              shown.length === 3 && index === 0 && 'col-span-2 sm:col-span-1',
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(index)}
              aria-label={`Открыть фото ${index + 1} из ${photos.length}`}
              data-no-tooltip
              className="group block size-full overflow-hidden bg-surface-3 focus-visible:field-focus"
            >
              <img
                src={photo.url}
                alt={photo.alt ?? ''}
                loading="lazy"
                className={cn(
                  'size-full object-cover transition-[scale] duration-340 ease-emphasized group-hover:scale-[1.03]',
                  shown.length === 1 ? 'aspect-video' : 'aspect-[4/3] sm:aspect-auto sm:min-h-32',
                )}
              />
              {hidden > 0 && index === shown.length - 1 && (
                <span className="absolute inset-0 grid place-items-center bg-scrim font-mono text-h3 text-white">
                  +{hidden}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Lightbox photos={photos} index={open} onIndex={setOpen} />
    </>
  )
}

/** Просмотр фото на весь экран. Нативный <dialog>: фокус и Escape — от браузера */
export function Lightbox({
  photos,
  index,
  onIndex,
}: {
  photos: Photo[]
  index: number | null
  onIndex: (index: number | null) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = index != null
  const count = photos.length
  const go = (offset: number) => index != null && onIndex((index + offset + count) % count)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const photo = index != null ? photos[index] : null
  return (
    <dialog
      ref={ref}
      aria-label="Просмотр фото"
      onClose={() => onIndex(null)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(1)
        if (event.key === 'ArrowLeft') go(-1)
      }}
      onClick={(event) => event.target === event.currentTarget && onIndex(null)}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-photo-scrim"
    >
      {photo && (
        <div
          className="grid size-full grid-rows-[auto_minmax(0,1fr)] p-3 sm:p-6"
          onClick={(event) => event.target === event.currentTarget && onIndex(null)}
        >
          <div className="flex items-center justify-between gap-3 text-white">
            <span className="font-mono text-sm">
              {index! + 1} / {count}
            </span>
            <IconButton
              aria-label="Закрыть"
              icon={<IconClose />}
              className="text-white hover:bg-white/10"
              onClick={() => onIndex(null)}
            />
          </div>
          <div className="relative grid min-h-0 place-items-center">
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.alt ?? ''}
              className="max-h-full max-w-full animate-pop-in rounded-md object-contain"
            />
            {count > 1 && (
              <>
                <IconButton
                  aria-label="Предыдущее фото"
                  icon={<IconChevronLeft />}
                  onClick={() => go(-1)}
                  className="absolute left-0 bg-photo-control text-white hover:bg-photo-scrim"
                />
                <IconButton
                  aria-label="Следующее фото"
                  icon={<IconChevronRight />}
                  onClick={() => go(1)}
                  className="absolute right-0 bg-photo-control text-white hover:bg-photo-scrim"
                />
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
