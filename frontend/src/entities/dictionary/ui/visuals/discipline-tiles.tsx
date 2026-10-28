import { cn, disciplineIconName as iconFor } from '@/shared/lib'
import { DisciplineIcon } from '@/shared/ui'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame, visualItemClass } from './visual-frame'

/** Дисциплины плитками с фирменными иконками — так они выглядят на сайте федерации */
export function DisciplineTiles({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  return (
    <VisualFrame label="Дисциплины">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {active.map((item, index) => {
          const icon = iconFor(item.name)
          return (
            <li key={item.id} style={{ animationDelay: `${index * 40}ms` }} className="animate-rise">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  visualItemClass,
                  'group flex h-full w-full flex-col items-start gap-4 rounded-md border border-line-soft bg-canvas/60 p-4 text-left hover:-translate-y-0.5 hover:border-line',
                )}
              >
                <DisciplineIcon
                  name={icon}
                  className="size-10 transition-[translate] duration-340 ease-spring group-hover:-translate-y-0.5"
                />
                <span className="line-clamp-3 text-sm text-ink">{item.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </VisualFrame>
  )
}
