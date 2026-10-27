import { useState } from 'react'
import { cn } from '@/shared/lib'
import { attachmentUrl } from '../lib/describe'

/**
 * Обложка или картинка статьи. Нет файла или он не загрузился — сетка с подписью раздела,
 * как обложка карточки соревнования без фото, а не битая картинка с alt-текстом.
 */
export function NewsCover({
  fileId,
  alt = '',
  label,
  className,
}: {
  fileId: string | null
  alt?: string
  /** Подпись на заглушке: раздел статьи */
  label?: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!fileId || failed)
    return (
      <div
        className={cn('grid-texture flex aspect-video items-end p-5 font-mono text-xs text-muted', className)}
      >
        {label ?? 'Новости ФСП'}
      </div>
    )
  return (
    <img
      src={attachmentUrl(fileId)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('aspect-video w-full bg-surface-3 object-cover', className)}
    />
  )
}
