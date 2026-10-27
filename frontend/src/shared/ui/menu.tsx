import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { cn } from '@/shared/lib'
import { IconCheck } from './icons'
import { Popover } from './popover'

export interface MenuItem {
  id: string
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Отмеченный пункт: текущая роль, выбранная сортировка */
  selected?: boolean
  disabled?: boolean
  onSelect: () => void
}

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>
  onClick: () => void
  onKeyDown: (event: KeyboardEvent) => void
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string
}

export interface MenuProps {
  items: MenuItem[]
  /** Кнопка-триггер получает ref и aria-атрибуты: вид у неё любой */
  trigger: (props: MenuTriggerProps) => ReactNode
  align?: 'start' | 'end'
  'aria-label'?: string
}

/** Меню действий: переключатель роли, «ещё» у строки таблицы. Стрелки, Home/End, Enter, Escape */
export function Menu({ items, trigger, align = 'start', ...aria }: MenuProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const focusItem = (index: number | 'first' | 'last') => {
    const nodes = [
      ...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ]
    if (!nodes.length) return
    const current = nodes.indexOf(document.activeElement as HTMLElement)
    const next =
      index === 'first'
        ? 0
        : index === 'last'
          ? nodes.length - 1
          : (current + index + nodes.length) % nodes.length
    nodes[next]?.focus()
  }

  const openMenu = (focus: 'first' | 'last') => {
    setOpen(true)
    // Фокус в меню — после того, как панель стала видимой
    requestAnimationFrame(() => focusItem(focus))
  }

  const close = () => setOpen(false)

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number | 'first' | 'last'> = {
      ArrowDown: 1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    }
    if (event.key in moves) {
      event.preventDefault()
      focusItem(moves[event.key]!)
    } else if (event.key === 'Tab') {
      close()
    }
  }

  return (
    <>
      {trigger({
        ref: anchorRef,
        onClick: () => (open ? close() : openMenu('first')),
        onKeyDown: onTriggerKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      <Popover open={open} onClose={close} anchorRef={anchorRef} align={align}>
        <div ref={listRef} id={id} role="menu" onKeyDown={onMenuKeyDown} className="flex flex-col" {...aria}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close()
                anchorRef.current?.focus()
                item.onSelect()
              }}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-left text-body text-ink outline-none',
                'transition-colors duration-150 hover:bg-hover-tint focus-visible:bg-hover-tint',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{item.label}</span>
                {item.description && <span className="text-sm text-muted">{item.description}</span>}
              </span>
              <IconCheck
                size={18}
                className={cn(
                  'shrink-0 transition-[opacity,scale] duration-220 ease-spring',
                  item.selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                )}
              />
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}
