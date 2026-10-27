import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn, plural } from '@/shared/lib'
import { IconButton } from './icon-button'
import { IconClose } from './icons'

/**
 * Панель массовых действий: всплывает снизу, когда что-то выбрано (useSelection).
 * Например, «Принять» / «Отклонить» для заявок участников или «Назначить» для судей.
 */
export function SelectionBar({
  count,
  onClear,
  children,
  noun = ['запись', 'записи', 'записей'],
}: {
  count: number
  onClear: () => void
  /** Кнопки действий */
  children: ReactNode
  noun?: [string, string, string]
}) {
  const open = count > 0
  // Портал в body: у страницы есть анимация с transform, внутри неё fixed прилипает к странице, а не к экрану
  return createPortal(
    <div
      inert={!open}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 transition-[opacity,translate] duration-260 ease-emphasized',
        open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      <div
        role="region"
        aria-label="Действия с выбранным"
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 overlay py-2 pr-2 pl-4"
      >
        <span className="font-mono text-sm whitespace-nowrap text-ink">
          {count} {plural(count, noun)}
        </span>
        <span className="mx-1 h-6 w-px bg-line-soft" aria-hidden="true" />
        {children}
        <IconButton aria-label="Снять выбор" size="sm" icon={<IconClose size={18} />} onClick={onClear} />
      </div>
    </div>,
    document.body,
  )
}
