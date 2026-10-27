import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconChevronDown } from './icons'

export interface AccordionItem {
  id: string
  title: ReactNode
  content: ReactNode
}

/**
 * Список вопросов с разделителями, как FAQ на fsp-russia.ru. Одновременно открыт один пункт (кит §5.16).
 * Высота анимируется через grid-template-rows 0fr → 1fr.
 */
export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const baseId = useId()

  return (
    <div className={cn('flex flex-col', className)}>
      {items.map((item) => {
        const open = openId === item.id
        const buttonId = `${baseId}-${item.id}-button`
        const panelId = `${baseId}-${item.id}-panel`
        return (
          <div key={item.id} className="border-b border-line-soft last:border-b-0">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
                className="group flex w-full items-center gap-4 py-5 text-left text-lead text-ink"
              >
                <span className="flex-1 transition-colors duration-150 group-hover:text-primary-text">
                  {item.title}
                </span>
                <IconChevronDown
                  className={cn(
                    'shrink-0 text-muted transition-[rotate,color] duration-340 ease-emphasized group-hover:text-ink',
                    open && 'rotate-180 text-ink',
                  )}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!open}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-340 ease-emphasized',
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="max-w-3xl pb-6 text-body text-muted">{item.content}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
