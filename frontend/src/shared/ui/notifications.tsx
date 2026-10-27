import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib'
import { Button } from './button'
import { IconBell } from './icons'
import { Popover } from './popover'

export interface NotificationItem {
  id: string
  title: string
  text?: string
  /** Уже отформатированное время: «5 мин назад», «вчера, 18:20» */
  time: string
  unread?: boolean
  /** Куда ведёт уведомление: заявка, соревнование, решение по роли */
  to?: string
}

/** Лента уведомлений: непрочитанные с синей точкой. Для попапа у колокольчика и для отдельной страницы */
export function NotificationList({
  items,
  onOpen,
  empty = 'Новых уведомлений нет',
}: {
  items: NotificationItem[]
  onOpen?: (item: NotificationItem) => void
  empty?: string
}) {
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-muted">{empty}</p>
  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {items.map((item) => {
        const body = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'mt-2 size-2 shrink-0 rounded-full',
                item.unread ? 'bg-primary' : 'bg-transparent',
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn('text-body', item.unread ? 'text-ink' : 'text-muted')}>{item.title}</span>
              {item.text && <span className="line-clamp-2 text-sm text-muted">{item.text}</span>}
              <span className="font-mono text-xs text-muted">{item.time}</span>
            </span>
          </>
        )
        const className = 'flex gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-hover-tint'
        return (
          <li key={item.id}>
            {item.to ? (
              <Link to={item.to} onClick={() => onOpen?.(item)} className={className}>
                {body}
                {item.unread && <span className="sr-only">(не прочитано)</span>}
              </Link>
            ) : (
              <button type="button" onClick={() => onOpen?.(item)} className={cn(className, 'w-full')}>
                {body}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Колокольчик со счётчиком непрочитанных и лентой в попапе.
 * Данные и «прочитать» — снаружи (entities/notification), здесь только вид.
 */
export function NotificationBell({
  items,
  onOpen,
  onReadAll,
  allTo,
  tone = 'canvas',
}: {
  items: NotificationItem[]
  onOpen?: (item: NotificationItem) => void
  onReadAll?: () => void
  /** Страница со всеми уведомлениями */
  allTo?: string
  tone?: 'canvas' | 'paper'
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const unread = items.filter((item) => item.unread).length

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={unread ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative grid size-10 shrink-0 pressable place-items-center rounded-md',
          tone === 'paper' ? 'text-on-paper hover:bg-paper-2' : 'text-ink hover:bg-hover-tint',
        )}
      >
        <IconBell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 animate-pop-in place-items-center rounded-full bg-live px-1 font-mono text-[0.625rem] leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        align="end"
        className="w-[min(24rem,calc(100vw-1rem))] p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <span className="text-body text-ink">Уведомления</span>
          {unread > 0 && onReadAll && (
            <Button variant="text" size="sm" onClick={onReadAll}>
              Прочитать все
            </Button>
          )}
        </div>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
          <NotificationList
            items={items}
            onOpen={(item) => {
              setOpen(false)
              onOpen?.(item)
            }}
          />
        </div>
        {allTo && (
          <Link
            to={allTo}
            onClick={() => setOpen(false)}
            className="block border-t border-line-soft px-4 py-3 text-center text-sm text-primary-text hover:bg-hover-tint"
          >
            Все уведомления
          </Link>
        )}
      </Popover>
    </>
  )
}
