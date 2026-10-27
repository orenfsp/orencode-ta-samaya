import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconButton } from './icon-button'
import { IconClose, IconPlus } from './icons'
import { PersonLine } from './person-line'

export interface RosterMember {
  id: string
  name: string
  meta?: ReactNode
  avatar?: string | null
  /** Капитан команды — помечается и не удаляется кнопкой в строке */
  captain?: boolean
}

/**
 * Состав команды по слотам: занятые места — люди, свободные до минимума — пунктир «нужен ещё»,
 * сверх минимума до максимума — тихое «можно добавить». Сразу видно, хватает ли людей для заявки.
 * Кого добавить, выбирает родитель (SearchSelect в Popover/Drawer) по onAdd.
 */
export function RosterSlots({
  members,
  min,
  max,
  onAdd,
  onRemove,
  readOnly = false,
  className,
}: {
  members: RosterMember[]
  min: number
  max: number
  onAdd?: () => void
  onRemove?: (id: string) => void
  readOnly?: boolean
  className?: string
}) {
  const missing = Math.max(0, min - members.length)
  const optional = Math.max(0, max - Math.max(min, members.length))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">
          Состав <span className="font-mono text-ink">{members.length}</span> из{' '}
          {min === max ? max : `${min}–${max}`}
        </span>
        {missing > 0 ? (
          <span className="text-sm text-live-text">Не хватает: {missing}</span>
        ) : (
          <span className="text-sm text-primary-text">Состав собран</span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <li key={member.id} className="rounded-md border border-line-soft px-3 py-2.5">
            <PersonLine
              name={member.name}
              meta={member.captain ? <span className="text-primary-text">Капитан</span> : member.meta}
              avatar={member.avatar}
              trailing={
                !readOnly &&
                !member.captain &&
                onRemove && (
                  <IconButton
                    aria-label={`Убрать из состава: ${member.name}`}
                    size="sm"
                    icon={<IconClose size={18} />}
                    onClick={() => onRemove(member.id)}
                  />
                )
              }
            />
          </li>
        ))}
        {!readOnly &&
          Array.from({ length: missing + optional }, (_, index) => {
            const required = index < missing
            return (
              <li key={`slot-${index}`}>
                <button
                  type="button"
                  onClick={onAdd}
                  disabled={!onAdd}
                  className={cn(
                    'flex w-full pressable items-center gap-3 rounded-md border border-dashed px-3 py-2.5 text-left text-sm',
                    required
                      ? 'border-line text-ink hover:border-primary hover:text-primary-text'
                      : 'border-line-soft text-muted hover:border-line hover:text-ink',
                  )}
                >
                  <span className="grid size-11 place-items-center rounded-full border border-dashed border-current">
                    <IconPlus size={18} />
                  </span>
                  {required ? 'Добавить участника' : 'Можно добавить ещё'}
                </button>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
