import { useState } from 'react'
import { cn, initials } from '@/shared/lib'

const sizes = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-body', xl: 'size-24 text-h3' }

export interface AvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof sizes
  className?: string
}

/**
 * Нет фото — инициалы на синем круге, а не одинаковая иконка у всех (кит §9).
 * Инициалы видны, пока фото грузится; фото проявляется поверх, битое или отсутствующее — не показывается.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [state, setState] = useState<{
    src: string | null | undefined
    status: 'loading' | 'ready' | 'failed'
  }>({
    src,
    status: 'loading',
  })
  // Новая ссылка — заново ждём загрузку, без эффекта
  const status = state.src === src ? state.status : 'loading'
  if (state.src !== src) setState({ src, status: 'loading' })

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-medium text-white select-none',
        sizes[size],
        className,
      )}
    >
      <span aria-label={status === 'ready' ? undefined : name} role={status === 'ready' ? undefined : 'img'}>
        {initials(name)}
      </span>
      {src && status !== 'failed' && (
        <img
          src={src}
          alt={name}
          onLoad={() => setState({ src, status: 'ready' })}
          onError={() => setState({ src, status: 'failed' })}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-200',
            status === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  )
}
