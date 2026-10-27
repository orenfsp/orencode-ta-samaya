import { useState } from 'react'
import { cn, initials } from '@/shared/lib'

const sizes = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-body', xl: 'size-24 text-h3' }

export interface AvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof sizes
  className?: string
}

/** Нет фото — инициалы на синем круге, а не одинаковая иконка у всех (кит §9) */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-bold text-white select-none',
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img src={src} alt={name} onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span aria-label={name} role="img">
          {initials(name)}
        </span>
      )}
    </span>
  )
}
